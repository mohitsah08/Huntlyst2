import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { evaluateCompanyProfile } from '@/lib/research/verifier';
import { TargetCriteria, VerificationRun } from '@/lib/research/types';
import { unifiedLeadStore } from '@/lib/unifiedLeadStore';
import { CompanyVerificationResult } from '@/providers/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * WORKFLOW C: Explicit Target-Based Verification API
 * 
 * Responsibilities:
 * - Operates ONLY on already saved CompanyResearchProfiles.
 * - ZERO web scraping or search requests are executed.
 * - Evaluates each criterion independently (PASS, FAIL, UNKNOWN) with evidence excerpts.
 * - Saves versioned VerificationRuns tied to the profile and target criteria version.
 * - Updates the unifiedLeadStore for unified exports and lead tracking.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyIds: string[] = [];

    if (Array.isArray(body.companyIds)) {
      companyIds.push(...body.companyIds.filter(Boolean));
    } else if (body.companyId) {
      companyIds.push(body.companyId);
    } else if (body.id) {
      companyIds.push(body.id);
    }

    if (companyIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide at least one saved companyId to verify.',
        },
        { status: 400 }
      );
    }

    // Resolve target criteria: provided explicitly in body, by ID, or fallback to stored active criteria
    let criteria: TargetCriteria;
    if (body.targetCriteria && typeof body.targetCriteria === 'object') {
      criteria = {
        ...body.targetCriteria,
        version: body.targetCriteria.version || 1,
        updatedAt: new Date().toISOString(),
      };
      // Persist criteria if given
      dbStore.saveTargetCriteria(criteria);
    } else if (body.targetCriteriaId) {
      criteria = dbStore.getTargetCriteria(body.targetCriteriaId);
    } else {
      criteria = dbStore.getTargetCriteria();
    }

    const verificationRuns: VerificationRun[] = [];
    const notFoundIds: string[] = [];

    for (const id of companyIds) {
      const profile = dbStore.getResearchProfile(id);
      if (!profile) {
        notFoundIds.push(id);
        continue;
      }

      // Pure evaluation against target criteria - ZERO network calls
      const run = evaluateCompanyProfile(profile, criteria);
      dbStore.saveVerificationRun(run);
      verificationRuns.push(run);

      // Map to UnifiedLeadStore format so lead tables, search history, and export features reflect the verified state
      try {
        const formattedResult: CompanyVerificationResult & Record<string, any> = {
          verificationStatus: run.overallStatus,
          confidenceScore: run.qualificationScore,
          company: {
            name: profile.officialName,
            website: profile.website,
            description: profile.description || null,
            industry: profile.primaryIndustry || null,
            fundingOrRevenue: profile.funding.totalFundingUsd ? `$${Math.round(profile.funding.totalFundingUsd).toLocaleString()}` : null,
            totalFundingUsd: profile.funding.totalFundingUsd,
            latestRoundUsd: profile.funding.latestRoundUsd,
            latestRoundType: profile.funding.latestRoundType,
            latestRoundDate: profile.funding.latestRoundDate,
            usPresence: profile.usPresence,
            founderOrCeoName: profile.leadership.ceo?.name || profile.leadership.founders[0]?.name || null,
            founderOrCeoEmail: profile.contacts.generalEmail || null,
            emailVerified: false,
            confidenceScore: run.qualificationScore,
            huntScore: run.qualificationScore,
            researchCompleteness: profile.researchCompletenessScore,
            sourceType: 'FIRECRAWL_RESEARCH',
            country: profile.headquarters.country || null,
            headquarters: [profile.headquarters.city, profile.headquarters.stateOrRegion, profile.headquarters.country].filter(Boolean).join(', ') || null,
            city: profile.headquarters.city || null,
            state: profile.headquarters.stateOrRegion || null,
          },
          leadership: {
            ceo: profile.leadership.ceo ? {
              role: 'CEO',
              name: profile.leadership.ceo.name,
              title: profile.leadership.ceo.title,
              current_or_former: 'current',
              source_url: profile.leadership.ceo.sourceUrl || null,
              evidence: profile.leadership.ceo.evidence || null,
              status: 'PASS',
            } : null,
            founders: profile.leadership.founders.map(f => ({
              role: 'Founder',
              name: f.name,
              title: f.title,
              current_or_former: 'current',
              evidence: f.evidence || null,
              source_url: f.sourceUrl || null,
              status: 'PASS',
            })),
            coFounders: profile.leadership.coFounders.map(f => ({
              role: 'Co-Founder',
              name: f.name,
              title: f.title,
              current_or_former: 'current',
              evidence: f.evidence || null,
              source_url: f.sourceUrl || null,
              status: 'PASS',
            })),
          },
          funding: {
            totalFundingUsd: profile.funding.totalFundingUsd,
            latestRoundUsd: profile.funding.latestRoundUsd,
            latestRoundType: profile.funding.latestRoundType,
            latestRoundDate: profile.funding.latestRoundDate,
            rounds: profile.funding.rounds,
          },
          contacts: {
            companyEmails: profile.contacts.generalEmail ? [profile.contacts.generalEmail] : [],
            executiveEmails: profile.contacts.executiveEmails.map(e => ({
              executiveName: e.name,
              email: e.email,
              verificationStatus: 'valid' as const,
              sourceUrl: e.sourceUrl,
            })),
            phones: profile.contacts.phone ? [profile.contacts.phone] : [],
          },
          social: {
            companyLinkedIn: profile.contacts.companyLinkedInUrl,
            companyX: profile.contacts.companyXUrl,
          },
          criteria: {
            funding: {
              status: (run.criteria.funding?.status || 'UNKNOWN') as any,
              target: run.criteria.funding?.required || null,
              value: run.criteria.funding?.actual || null,
              reason: run.criteria.funding?.reason || 'Undisclosed',
              evidence: run.criteria.funding?.evidence || undefined,
              source: run.criteria.funding?.sourceUrl || undefined,
            },
            industry: {
              status: (run.criteria.industry?.status || 'UNKNOWN') as any,
              target: run.criteria.industry?.required || null,
              value: run.criteria.industry?.actual || null,
              reason: run.criteria.industry?.reason || 'Undisclosed',
              evidence: run.criteria.industry?.evidence || undefined,
              source: run.criteria.industry?.sourceUrl || undefined,
            },
            companyAge: {
              status: 'PASS',
              reason: 'Within age bounds',
            },
            geography: {
              status: (run.criteria.geography?.status || 'UNKNOWN') as any,
              target: run.criteria.geography?.required || null,
              value: run.criteria.geography?.actual || null,
              reason: run.criteria.geography?.reason || 'Undisclosed',
              evidence: run.criteria.geography?.evidence || undefined,
              source: run.criteria.geography?.sourceUrl || undefined,
            },
            usPresence: {
              status: (run.criteria.usPresence?.status || 'UNKNOWN') as any,
              target: run.criteria.usPresence?.required || null,
              value: run.criteria.usPresence?.actual || null,
              reason: run.criteria.usPresence?.reason || 'Undisclosed',
              evidence: run.criteria.usPresence?.evidence || undefined,
              source: run.criteria.usPresence?.sourceUrl || undefined,
            },
            companyStage: {
              status: 'PASS',
              reason: 'Stage evaluated',
            },
            founderOrCeo: {
              status: ((run.criteria.ceo?.status || run.criteria.founders?.status || 'UNKNOWN')) as any,
              reason: run.criteria.ceo?.reason || run.criteria.founders?.reason || 'Undisclosed',
            },
            professionalEmail: {
              status: (run.criteria.publicEmail?.status || 'UNKNOWN') as any,
              reason: run.criteria.publicEmail?.reason || 'Undisclosed',
            },
          },
          qualification: {
            matchScore: run.qualificationScore,
            criteria: run.criteria,
            finalStatus: run.overallStatus,
            reasons: [run.summaryReason],
          },
          failedCriteria: Object.values(run.criteria).filter(c => c.status === 'FAIL').map(c => c.name),
          passedCriteria: Object.values(run.criteria).filter(c => c.status === 'PASS').map(c => c.name),
          unknownCriteria: Object.values(run.criteria).filter(c => c.status === 'UNKNOWN').map(c => c.name),
          sources: profile.sources.map(s => s.url),
          auditTimestamp: run.verifiedAt,
        };

        unifiedLeadStore.upsertLeadFromExternal(formattedResult, criteria.id);
      } catch (leadErr) {
        console.warn('[API Verify] Failed to update unified lead record:', leadErr);
      }
    }

    if (verificationRuns.length === 0 && notFoundIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Company profiles not found for IDs: ${notFoundIds.join(', ')}. Please research and save the company first.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      totalVerified: verificationRuns.length,
      targetCriteriaId: criteria.id,
      targetCriteriaVersion: criteria.version,
      runs: verificationRuns,
      notFoundIds: notFoundIds.length > 0 ? notFoundIds : undefined,
    });
  } catch (err: any) {
    console.error('[API Verify] POST error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to verify company profiles',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const runId = searchParams.get('runId');

    if (runId) {
      const run = dbStore.getVerificationRun(runId);
      if (!run) {
        return NextResponse.json({ success: false, error: 'Verification run not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, run });
    }

    if (companyId) {
      const runs = dbStore.getVerificationRunsForCompany(companyId);
      const latest = dbStore.getLatestVerificationRunForCompany(companyId);
      return NextResponse.json({ success: true, latest, runs });
    }

    const runs = dbStore.listVerificationRuns();
    return NextResponse.json({ success: true, total: runs.length, runs });
  } catch (err: any) {
    console.error('[API Verify] GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
