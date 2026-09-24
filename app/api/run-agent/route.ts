/**
 * API Route: /api/run-agent
 * 
 * Orchestrates the full company discovery pipeline:
 * Discovery → Extraction → Validation → Email Verification → Dedupe/Rank
 * Supports dynamic HuntConfig parameterization and real-time Server-Sent Events (SSE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { discoverCompanies, extractDomain } from '@/lib/discovery';
import { extractAllCandidates } from '@/lib/extraction';
import { validateCompany, auditCompany } from '@/lib/validation';
import { findVerifiedEmail } from '@/lib/email';
import { rankCompanies, needsMoreDiscovery, MAX_DISCOVERY_ROUNDS } from '@/lib/rank';
import { RunAgentResult, ValidatedCompany, CompanyRecord, HuntConfig, TVB_EVALUATION_CONFIG, RejectedCompanyRecord } from '@/lib/types';
import { targetProfileToHuntConfig, TargetProfile } from '@/lib/targetProfileData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

interface PipelineStats {
  discovered: number;
  extracted: number;
  nonUsPassed: number;
  fundingQualified: number;
  founderFound: number;
  emailVerified: number;
  finalRanked: number;
  durationMs: number;
}

/**
 * Full execution logic with HuntConfig & optional streaming writer
 */
async function executePipeline(
  config: HuntConfig = TVB_EVALUATION_CONFIG,
  onEvent?: (event: { type: string; message: string; stage?: number; stageName?: string; company?: CompanyRecord; stats?: PipelineStats }) => void
): Promise<RunAgentResult> {
  const startTime = Date.now();
  const allValidated: ValidatedCompany[] = [];
  const allRankedCompanies: CompanyRecord[] = [];
  const allRejectedMap = new Map<string, RejectedCompanyRecord>();

  const stats: PipelineStats = {
    discovered: 0,
    extracted: 0,
    nonUsPassed: 0,
    fundingQualified: 0,
    founderFound: 0,
    emailVerified: 0,
    finalRanked: 0,
    durationMs: 0,
  };

  const log = (message: string, stage = 0, stageName = '') => {
    console.log(`[Agent] ${message}`);
    if (onEvent) {
      onEvent({ type: 'log', message, stage, stageName, stats });
    }
  };

  const targetLeads = config.targetLeads || config.targetProfile?.targetCount === 'Custom' ? (config.targetProfile?.customTargetCount || 15) : (config.targetProfile?.targetCount || 15);
  const targetGeo = config.geography.countries.length > 0
    ? config.geography.countries.join(', ')
    : config.geography.regions.length > 0
    ? config.geography.regions.join(', ')
    : 'Global Non-US';

  log(`Initializing Huntlyst Engine [Target: ${targetLeads} leads | Geo: ${targetGeo} | Mode: ${config.funding.preset || '$1M-$5M'}]...`, 0, 'Initialization');

  const maxRounds = config.depth === 'quick' ? 1 : config.depth === 'deep' || config.depth === 'exhaustive' ? 4 : MAX_DISCOVERY_ROUNDS;

  for (let round = 1; round <= maxRounds; round++) {
    log(`[Round ${round}/${maxRounds}] Commencing dynamic discovery for ${targetGeo}...`, 1, 'Discovery');

    // 1. Discovery
    const candidates = await discoverCompanies(config);
    stats.discovered += candidates.length;
    log(`[Round ${round}] Discovered ${candidates.length} candidate URLs matching hunt criteria`, 1, 'Discovery');

    if (candidates.length === 0) {
      log(`[Round ${round}] No further candidates in this round.`, 1, 'Discovery');
      break;
    }

    // 2. Extraction
    const concurrency = config.depth === 'quick' ? 3 : 5;
    log(`[Round ${round}] Extracting structured intelligence for ${candidates.length} candidates (concurrency: ${concurrency})...`, 2, 'Extraction');
    const extractedMap = await extractAllCandidates(candidates, concurrency);
    stats.extracted += extractedMap.size;
    log(`[Round ${round}] Extracted ${extractedMap.size} company profiles`, 2, 'Extraction');

    // 3. Validation
    log(`[Round ${round}] Applying deterministic validation (${targetGeo}, ${config.funding.preset || '$1M-$5M'}, ${config.techProfile})...`, 3, 'Validation');
    const roundValidated: ValidatedCompany[] = [];

    for (const [url, data] of extractedMap.entries()) {
      const candidate = candidates.find(c => c.url === url);
      const audit = auditCompany(data, url, candidate?.source || 'Discovery', config);

      if (audit.qualified && audit.validatedCompany) {
        stats.nonUsPassed++;
        stats.fundingQualified++;
        stats.founderFound++;
        roundValidated.push(audit.validatedCompany);
        log(`✓ Qualified: ${audit.validatedCompany.name} [HQ: ${audit.validatedCompany.country || 'Verified'} | ${audit.validatedCompany.industry}]`, 3, 'Validation');
      } else if (audit.rejectedRecord) {
        const domain = extractDomain(url);
        if (!allRejectedMap.has(domain)) {
          allRejectedMap.set(domain, audit.rejectedRecord);
        }
      }
    }

    log(`[Round ${round}] Validated ${roundValidated.length} companies matching all criteria`, 3, 'Validation');
    allValidated.push(...roundValidated);

    if (roundValidated.length === 0) {
      if (!needsMoreDiscovery(allRankedCompanies.length, targetLeads)) break;
      continue;
    }

    // 4. Email Verification
    log(`[Round ${round}] Verifying executive leadership emails via live DNS MX...`, 4, 'Email Verification');
    const emailResults = new Map<string, { email: string | null; verified: boolean; mxHost?: string | null }>();

    for (const comp of roundValidated) {
      const emailRes = await findVerifiedEmail(comp.founderOrCeoName || 'Founder', comp.website);
      emailResults.set(comp.website, emailRes);

      if (emailRes.verified && emailRes.email) {
        stats.emailVerified++;
        log(`✓ Mailbox routable: ${emailRes.email} for ${comp.name} [MX: ${emailRes.mxHost || 'Verified'}]`, 4, 'Email Verification');
      } else if (config.emailVerification === 'required' || config.targetProfile?.emailRequirement === 'Required') {
        const domain = extractDomain(comp.website);
        if (!allRejectedMap.has(domain)) {
          const nowIso = new Date().toISOString();
          allRejectedMap.set(domain, {
            name: comp.name,
            website: comp.website,
            industry: comp.industry || 'Tech Platform',
            fundingOrRevenue: comp.fundingOrRevenueText || 'In Range',
            location: comp.country || 'Non-US',
            founderOrCeoName: comp.founderOrCeoName ?? undefined,
            rejectionReasons: ['EMAIL_NOT_VERIFIED'],
            matchedRules: [
              `✓ Industry: ${comp.industry}`,
              `✓ Location: ${comp.country}`,
              `✓ Executive: ${comp.founderOrCeoName}`,
              `✓ Funding range`,
            ],
            failedRules: ['✗ Professional email deliverability unverified on live MX'],
            sourceEvidence: `DNS MX check could not establish deliverable mailbox for ${comp.founderOrCeoName}`,
            firstDiscoveredAt: nowIso,
            lastSeenAt: nowIso,
            lastVerifiedAt: nowIso,
            lastUpdatedAt: nowIso,
          });
        }
      }
    }

    // 5. Ranking and Deduplication
    log(`[Round ${round}] Computing evidence-based Hunt Scores (0–100)...`, 5, 'Ranking');
    const ranked = rankCompanies(roundValidated, emailResults, config);

    for (const comp of ranked) {
      allRankedCompanies.push(comp);
      if (onEvent) {
        onEvent({ type: 'candidate_found', message: `Qualified: ${comp.name} (Hunt Score: ${comp.huntScore}/100)`, company: comp, stats });
      }
    }

    // Check if target met
    if (!needsMoreDiscovery(allRankedCompanies.length, targetLeads)) {
      log(`Target reached! ${allRankedCompanies.length} fully qualified companies discovered.`, 5, 'Ranking');
      break;
    }
  }

  // Deduplicate across all rounds
  const domainMap = new Map<string, CompanyRecord>();
  for (const comp of allRankedCompanies) {
    try {
      const domain = new URL(comp.website.startsWith('http') ? comp.website : `https://${comp.website}`).hostname.replace(/^www\./, '');
      const existing = domainMap.get(domain);
      if (!existing || (comp.huntScore || 0) > (existing.huntScore || 0)) {
        domainMap.set(domain, comp);
      }
    } catch {
      domainMap.set(comp.name, comp);
    }
  }

  const finalCompanies = Array.from(domainMap.values())
    .sort((a, b) => (b.huntScore || 0) - (a.huntScore || 0));

  stats.finalRanked = finalCompanies.length;
  stats.durationMs = Date.now() - startTime;

  log(`Pipeline finished in ${(stats.durationMs / 1000).toFixed(1)}s. Total qualified: ${finalCompanies.length}`, 5, 'Complete');

  return {
    companies: finalCompanies,
    rejectedCompanies: Array.from(allRejectedMap.values()),
    totalDiscovered: stats.discovered,
    totalQualified: finalCompanies.length,
    stats,
  };
}

export async function POST(request: NextRequest) {
  const isStream = request.nextUrl.searchParams.get('stream') === 'true' ||
    request.headers.get('accept')?.includes('text/event-stream');

  let config: HuntConfig = TVB_EVALUATION_CONFIG;
  try {
    const body = await request.json().catch(() => null);
    if (body) {
      if (body.targetProfile) {
        config = body as HuntConfig;
      } else if (body.targetCount !== undefined || body.industries) {
        // Direct TargetProfile sent
        config = targetProfileToHuntConfig(body as TargetProfile);
      } else if (body.geography) {
        config = body as HuntConfig;
      }
    }
  } catch {}

  if (isStream) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (data: any) => {
      try {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        await writer.write(encoder.encode(payload));
      } catch {}
    };

    (async () => {
      try {
        const result = await executePipeline(config, (event) => {
          sendEvent(event);
        });
        await sendEvent({ type: 'complete', message: 'Pipeline complete', result });
      } catch (err: any) {
        await sendEvent({ type: 'error', message: err.message || 'Pipeline execution failed' });
      } finally {
        await writer.close();
      }
    })();

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  }

  // Standard JSON response
  try {
    const result = await executePipeline(config);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Pipeline execution error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}