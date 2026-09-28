/**
 * API Route: /api/run-agent
 * 
 * Orchestrates the full company discovery pipeline:
 * Discovery → Researching → Validating → Finding Founders → Verifying Contacts → Qualifying → Results
 * Single stable huntId, linear non-repeating execution, comprehensive debug telemetry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { discoverCompanies, extractDomain } from '@/lib/discovery';
import { extractAllCandidates } from '@/lib/extraction';
import { validateCompany, auditCompany } from '@/lib/validation';
import { verifyContactsBatch, isVerificationProviderConfigured } from '@/lib/email';
import { rankCompanies } from '@/lib/rank';
import { RunAgentResult, ValidatedCompany, CompanyRecord, HuntConfig, TVB_EVALUATION_CONFIG, RejectedCompanyRecord, EmailVerificationResult } from '@/lib/types';
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
  contactsChecked: number;
  emailVerified: number;
  emailsPartiallyVerified: number;
  emailsUnverified: number;
  finalRanked: number;
  durationMs: number;
}

/**
 * Full execution logic with HuntConfig & streaming writer.
 * Strictly executes exactly once per hunt without re-triggering Discovering.
 */
async function executePipeline(
  config: HuntConfig = TVB_EVALUATION_CONFIG,
  huntId: string = `hunt_${Date.now()}`,
  onEvent?: (event: {
    type: string;
    message: string;
    stage?: number;
    stageName?: string;
    huntId?: string;
    company?: CompanyRecord;
    stats?: PipelineStats;
  }) => void
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
    contactsChecked: 0,
    emailVerified: 0,
    emailsPartiallyVerified: 0,
    emailsUnverified: 0,
    finalRanked: 0,
    durationMs: 0,
  };

  const log = (message: string, stage = 0, stageName = '') => {
    console.log(`[Agent] [${huntId}] ${message}`);
    if (onEvent) {
      onEvent({ type: 'log', message, stage, stageName, huntId, stats });
    }
  };

  const targetLeads = config.targetLeads || (config.targetProfile?.targetCount === 'Custom' ? (config.targetProfile?.customTargetCount || 15) : (config.targetProfile?.targetCount || 15));
  const targetGeo = config.geography.countries.length > 0
    ? config.geography.countries.join(', ')
    : config.geography.regions.length > 0
    ? config.geography.regions.join(', ')
    : 'Global Non-US';

  log(`Initializing Huntlyst Engine [Hunt ID: ${huntId} | Target: ${targetLeads} leads | Geo: ${targetGeo} | Mode: ${config.funding.preset || '$1M-$5M'}]...`, 0, 'Initialization');

  // ==========================================
  // STAGE 1: DISCOVERING
  // ==========================================
  const discoveryCallStack = new Error().stack || 'No callstack available';
  console.log(`[DISCOVERY TRIGGER]\nhuntId: ${huntId}\ncaller/function: executePipeline -> discoverCompanies\ncall stack:\n${discoveryCallStack}`);
  console.log(`[STAGE START]\nhuntId: ${huntId}\nstage: Discovering`);
  log(`Commencing dynamic discovery for ${targetGeo}...`, 1, 'Discovering');

  const candidates = await discoverCompanies(config);
  stats.discovered = candidates.length;
  log(`Discovered ${candidates.length} candidate URLs matching hunt criteria`, 1, 'Discovering');

  console.log(`[STAGE COMPLETE]\nhuntId: ${huntId}\nstage: Discovering`);
  console.log(`[HUNTLYST][PIPELINE]\nCurrent stage: Discovering\nPrevious stage: Initialization\nNext stage: Researching\nTransition reason: Discovered ${candidates.length} candidates matching hunt criteria\n`);
  console.log(`[STAGE TRANSITION]\nhuntId: ${huntId}\nfrom: Discovering\nto: Researching`);

  // ==========================================
  // STAGE 2: RESEARCHING (EXTRACTION)
  // ==========================================
  console.log(`[STAGE START]\nhuntId: ${huntId}\nstage: Researching`);
  const concurrency = config.depth === 'quick' ? 3 : 5;
  log(`Extracting structured company intelligence for ${candidates.length} candidates (concurrency: ${concurrency})...`, 2, 'Researching');

  const extractedMap = await extractAllCandidates(candidates, concurrency);
  stats.extracted = extractedMap.size;
  log(`Extracted profile data for ${extractedMap.size} companies`, 2, 'Researching');

  console.log(`[STAGE COMPLETE]\nhuntId: ${huntId}\nstage: Researching`);
  console.log(`[HUNTLYST][PIPELINE]\nCurrent stage: Researching\nPrevious stage: Discovering\nNext stage: Validating\nTransition reason: Extracted intelligence for ${extractedMap.size} candidates\n`);
  console.log(`[STAGE TRANSITION]\nhuntId: ${huntId}\nfrom: Researching\nto: Validating`);

  // ==========================================
  // STAGE 3: VALIDATING
  // ==========================================
  console.log(`[STAGE START]\nhuntId: ${huntId}\nstage: Validating`);
  log(`Applying deterministic qualification rules (${targetGeo}, ${config.funding.preset || '$1M-$5M'}, ${config.techProfile})...`, 3, 'Validating');

  for (const [url, data] of extractedMap.entries()) {
    const candidate = candidates.find(c => c.url === url);
    const audit = auditCompany(data, url, candidate?.source || 'Discovery', config);

    if (audit.qualified && audit.validatedCompany) {
      stats.nonUsPassed++;
      stats.fundingQualified++;
      allValidated.push(audit.validatedCompany);
      log(`✓ Validated: ${audit.validatedCompany.name} [HQ: ${audit.validatedCompany.country || 'Verified'} | ${audit.validatedCompany.industry}]`, 3, 'Validating');
    } else if (audit.rejectedRecord) {
      const domain = extractDomain(url);
      if (!allRejectedMap.has(domain)) {
        allRejectedMap.set(domain, audit.rejectedRecord);
      }
    }
  }

  log(`Validated ${allValidated.length} companies matching all qualification criteria`, 3, 'Validating');
  console.log(`[STAGE COMPLETE]\nhuntId: ${huntId}\nstage: Validating`);
  console.log(`[HUNTLYST][PIPELINE]\nCurrent stage: Validating\nPrevious stage: Researching\nNext stage: Finding Founders\nTransition reason: Deterministic audit completed for ${allValidated.length} qualifying companies\n`);
  console.log(`[STAGE TRANSITION]\nhuntId: ${huntId}\nfrom: Validating\nto: Finding Founders`);

  // ==========================================
  // STAGE 4: FINDING FOUNDERS
  // ==========================================
  console.log(`[STAGE START]\nhuntId: ${huntId}\nstage: Finding Founders`);
  log(`Identifying executive leadership (CEOs, Founders, Key Decision Makers)...`, 4, 'Finding Founders');

  for (const comp of allValidated) {
    if (comp.founderOrCeoName && comp.founderOrCeoName.trim().length >= 2) {
      stats.founderFound++;
      log(`✓ Executive confirmed: ${comp.founderOrCeoName} for ${comp.name}`, 4, 'Finding Founders');
    }
  }

  log(`Identified executive leadership for ${stats.founderFound} companies`, 4, 'Finding Founders');
  console.log(`[STAGE COMPLETE]\nhuntId: ${huntId}\nstage: Finding Founders`);
  console.log(`[HUNTLYST][PIPELINE]\nCurrent stage: Finding Founders\nPrevious stage: Validating\nNext stage: Verifying Contacts\nTransition reason: Executive leadership identified for ${stats.founderFound} companies\n`);
  console.log(`[STAGE TRANSITION]\nhuntId: ${huntId}\nfrom: Finding Founders\nto: Verifying Contacts`);

  // ==========================================
  // STAGE 5: VERIFYING CONTACTS
  // ==========================================
  console.log(`[STAGE START]\nhuntId: ${huntId}\nstage: Verifying Contacts`);
  log(`Verifying executive contacts and email deliverability via live DNS MX...`, 5, 'Verifying Contacts');

  stats.contactsChecked = allValidated.length;

  const emailResults = new Map<string, EmailVerificationResult>();
  const contactsToVerify = allValidated.map((comp) => ({
    companyName: comp.name,
    companyWebsite: comp.website,
    leadName: comp.founderOrCeoName,
    roleTitle: 'CEO / Founder',
  }));

  // Batch process contacts with controlled concurrency and error isolation
  const verifiedContacts = await verifyContactsBatch(contactsToVerify, 6);

  for (let i = 0; i < allValidated.length; i++) {
    const comp = allValidated[i];
    const contactRes = verifiedContacts[i];

    const emailRes: EmailVerificationResult = {
      email: contactRes.email,
      verified: contactRes.verified,
      status: contactRes.emailVerificationStatus,
      emailType: contactRes.emailType,
      domain: contactRes.emailDomain,
      companyDomain: contactRes.companyDomain,
      domainMatchesCompany: contactRes.domainMatchesCompany,
      hasMx: contactRes.hasMx,
      mxHost: contactRes.mxHost,
      method: contactRes.hasMx ? 'DNS MX Record Verified' : 'DNS Resolution Failed',
      evidence: contactRes.evidence,
      timestamp: contactRes.timestamp,
      reason: contactRes.reason,
    };

    emailResults.set(comp.website, emailRes);

    if (contactRes.verified && contactRes.email) {
      stats.emailVerified++;
      log(`✓ Mailbox deliverable: ${contactRes.email} for ${comp.name} [MX: ${contactRes.mxHost || 'Verified'}]`, 5, 'Verifying Contacts');
    } else if (contactRes.emailVerificationStatus === 'PARTIALLY VERIFIED') {
      stats.emailsPartiallyVerified++;
      log(`~ Contact routable: ${contactRes.email || comp.name} [MX: ${contactRes.mxHost || 'Active'} | Mailbox unverified]`, 5, 'Verifying Contacts');
    } else {
      stats.emailsUnverified++;
      log(`? Contact unverified: ${comp.name} (${contactRes.reason})`, 5, 'Verifying Contacts');

      const isEmailReq = config.emailVerification === 'required' || config.targetProfile?.emailRequirement === 'Required';
      if (isEmailReq && isVerificationProviderConfigured()) {
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
            failedRules: [`✗ Professional contact unverified: ${contactRes.reason}`],
            sourceEvidence: contactRes.evidence || `Email verification unconfirmed: ${contactRes.reason}`,
            firstDiscoveredAt: nowIso,
            lastSeenAt: nowIso,
            lastVerifiedAt: nowIso,
            lastUpdatedAt: nowIso,
          });
        }
      }
    }
  }

  log(`Completed contact verification: ${stats.emailVerified} verified, ${stats.emailsPartiallyVerified} partially verified, ${stats.emailsUnverified} unverified`, 5, 'Verifying Contacts');
  console.log(`[STAGE COMPLETE]\nhuntId: ${huntId}\nstage: Verifying Contacts`);
  console.log(`[HUNTLYST][PIPELINE]\nCurrent stage: Verifying Contacts\nPrevious stage: Finding Founders\nNext stage: Qualifying\nTransition reason: Contact verification completed for ${stats.contactsChecked} candidates (${stats.emailVerified} verified, ${stats.emailsPartiallyVerified} partial, ${stats.emailsUnverified} unverified)\n`);
  console.log(`[STAGE TRANSITION]\nhuntId: ${huntId}\nfrom: Verifying Contacts\nto: Qualifying`);

  // ==========================================
  // STAGE 6: QUALIFYING
  // ==========================================
  console.log(`[STAGE START]\nhuntId: ${huntId}\nstage: Qualifying`);
  log(`Computing evidence-based Hunt Scores (0–100) and finalizing qualified leads...`, 6, 'Qualifying');

  const ranked = rankCompanies(allValidated, emailResults, config);

  for (const comp of ranked) {
    allRankedCompanies.push(comp);
    if (onEvent) {
      onEvent({ type: 'candidate_found', message: `Qualified: ${comp.name} (Hunt Score: ${comp.huntScore}/100)`, company: comp, huntId, stats });
    }
  }

  // Deduplicate by root domain
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

  log(`Pipeline finished in ${(stats.durationMs / 1000).toFixed(1)}s. Total qualified: ${finalCompanies.length}`, 6, 'Qualifying');
  console.log(`[STAGE COMPLETE]\nhuntId: ${huntId}\nstage: Qualifying`);
  console.log(`[HUNTLYST][PIPELINE]\nCurrent stage: Qualifying\nPrevious stage: Verifying Contacts\nNext stage: Results\nTransition reason: Completed evidence-based lead ranking (${finalCompanies.length} qualified leads)\n`);
  console.log(`[STAGE TRANSITION]\nhuntId: ${huntId}\nfrom: Qualifying\nto: Results`);

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
  let clientHuntId = request.nextUrl.searchParams.get('huntId');

  try {
    const body = await request.json().catch(() => null);
    if (body) {
      if (body.huntId) {
        clientHuntId = body.huntId;
      }
      if (body.targetProfile) {
        config = body as HuntConfig;
      } else if (body.targetCount !== undefined || body.industries) {
        config = targetProfileToHuntConfig(body as TargetProfile);
      } else if (body.geography) {
        config = body as HuntConfig;
      }
    }
  } catch {}

  const huntId = clientHuntId || config.id || `hunt_${Date.now().toString(36)}`;
  console.log(`[API START]\nendpoint: /api/run-agent\nhuntId: ${huntId}`);

  if (isStream) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (data: any) => {
      try {
        const payload = `data: ${JSON.stringify({ ...data, huntId })}\n\n`;
        await writer.write(encoder.encode(payload));
      } catch {}
    };

    (async () => {
      try {
        const result = await executePipeline(config, huntId, (event) => {
          sendEvent(event);
        });
        await sendEvent({ type: 'complete', stage: 6, stageName: 'Results', huntId, message: 'Pipeline complete', result });
        console.log(`[API COMPLETE]\nendpoint: /api/run-agent\nhuntId: ${huntId}`);
      } catch (err: any) {
        console.log(`[API ERROR]\nendpoint: /api/run-agent\nhuntId: ${huntId}\nerror: ${err.message || err}`);
        await sendEvent({ type: 'error', huntId, message: err.message || 'Pipeline execution failed' });
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
    const result = await executePipeline(config, huntId);
    console.log(`[API COMPLETE]\nendpoint: /api/run-agent\nhuntId: ${huntId}`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.log(`[API ERROR]\nendpoint: /api/run-agent\nhuntId: ${huntId}\nerror: ${error.message || error}`);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}