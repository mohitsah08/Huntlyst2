/**
 * API Route: /api/discovery/external
 * 
 * External Discovery Pipeline Stage:
 * 
 * Responsibilities:
 * 1. Accepts company names, websites, company URLs, or Lead Packages handed off from Internal.
 * 2. Runs real public/authorized web research without synthetic fabrication or guesses.
 * 3. Enforces the SAME 4 final statuses: VERIFIED | REVIEW | UNVERIFIED | REJECTED.
 * 4. Integrates with UnifiedLeadStore: merges into existing canonical lead records.
 *    Maintains provenance (origin: EXTERNAL, or BOTH if already existed in Internal).
 */

import { NextRequest, NextResponse } from 'next/server';
import { processCandidateThroughPipeline } from '@/lib/discoveryPipeline';
import { unifiedLeadStore } from '@/lib/unifiedLeadStore';
import { CompanyVerificationResult, ResearchCandidateInput } from '@/providers/types';
import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targetProfile: TargetProfile = body.targetProfile || DEFAULT_TVB_TARGET_PROFILE;
    
    // Log/capture active target profile details for every external run (Requirement 17)
    console.log(`[API External Discovery] Active Target Profile: ID="${targetProfile.id}", Name="${targetProfile.name}", Metric=${targetProfile.financialMetric}, Range=$${targetProfile.fundingMin}-$${targetProfile.fundingMax}, Countries=${targetProfile.countries?.join(', ') || 'Global'}`);
    
    const candidatesInput: ResearchCandidateInput[] = [];

    // Support handed-off LeadPackages or raw company objects/strings
    if (Array.isArray(body.companies)) {
      for (const item of body.companies) {
        if (typeof item === 'string') {
          const isUrl = item.startsWith('http') || item.includes('.');
          candidatesInput.push({
            name: isUrl ? undefined : item,
            website: isUrl ? item : undefined,
            url: isUrl ? item : undefined,
            source: 'External Target Entry',
          });
        } else if (typeof item === 'object' && item !== null) {
          // If handed off from Internal LeadPackage:
          if (item.lead_package || item.seed_data) {
            const pkg = item.lead_package || item;
            const norm = pkg.seed_data?.normalized || item;
            candidatesInput.push({
              name: norm.company_name || item.name,
              website: norm.website || item.website || item.url,
              url: norm.website || item.url || item.website,
              source: `Internal Handoff (${pkg.source?.file_name || 'File'})`,
              source_data: {
                name: norm.company_name || item.name || '',
                website: norm.website || item.website || null,
                raw_industry: norm.industry || null,
                country: norm.country || null,
                city: norm.city || null,
                founder: norm.founder_or_ceo || null,
                funding: norm.funding || null,
                raw_fields: pkg.seed_data?.raw_fields || {},
              },
            });
          } else {
            candidatesInput.push({
              name: item.name,
              website: item.website || item.url,
              url: item.url || item.website,
              source: item.source || 'External Target Entry',
              source_data: item.source_data,
            });
          }
        }
      }
    } else if (body.name || body.website || body.url) {
      candidatesInput.push({
        name: body.name,
        website: body.website || body.url,
        url: body.url || body.website,
        source: 'External Target Entry',
      });
    }

    if (candidatesInput.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Please provide at least one company name or website URL.',
        results: [],
        stats: { total: 0, verified: 0, review: 0, unverified: 0, rejected: 0 },
      }, { status: 400 });
    }

    const verificationResults: (CompanyVerificationResult & Record<string, any>)[] = [];
    const concurrency = 3;

    for (let i = 0; i < candidatesInput.length; i += concurrency) {
      const chunk = candidatesInput.slice(i, i + concurrency);
      const chunkPromises = chunk.map(cand => processCandidateThroughPipeline(cand, targetProfile));
      const chunkRes = await Promise.allSettled(chunkPromises);

      for (const res of chunkRes) {
        if (res.status === 'fulfilled') {
          const rawResult = res.value;

          // Normalize external status to the shared 4 statuses:
          // QUALIFIED -> VERIFIED, REVIEW -> REVIEW, REJECTED -> REJECTED, others -> UNVERIFIED
          if (rawResult.verificationStatus === 'QUALIFIED') {
            rawResult.verificationStatus = 'VERIFIED';
          } else if (rawResult.verificationStatus === 'PARTIALLY_VERIFIED' || rawResult.verificationStatus === 'ERROR') {
            rawResult.verificationStatus = 'UNVERIFIED';
          }

          // Build Detailed External JSON Model (Section 19 & 33) while preserving CompanyVerificationResult compatibility
          const formattedResult: CompanyVerificationResult & Record<string, any> = {
            ...rawResult,
            funding: {
              totalFundingUsd: rawResult.fundingDetails?.totalFundingUsd ?? rawResult.fundingDetails?.total_funding_usd ?? rawResult.funding?.totalFundingUsd ?? null,
              latestRoundUsd: rawResult.fundingDetails?.latestRoundUsd ?? rawResult.fundingDetails?.latest_round_usd ?? rawResult.funding?.latestRoundUsd ?? null,
              latestRoundDate: rawResult.fundingDetails?.latestRoundDate ?? rawResult.fundingDetails?.latest_round_date ?? rawResult.funding?.latestRoundDate ?? null,
              latestRoundType: rawResult.fundingDetails?.latestRoundType ?? rawResult.fundingDetails?.latest_round_type ?? rawResult.funding?.latestRoundType ?? null,
              fundingRounds: rawResult.fundingDetails?.fundingRounds || rawResult.fundingDetails?.rounds || rawResult.funding?.fundingRounds || [],
              rounds: rawResult.fundingDetails?.fundingRounds || rawResult.fundingDetails?.rounds || rawResult.funding?.fundingRounds || [],
              sources: rawResult.fundingDetails?.sources || [],
              conflicts: rawResult.conflictDetails?.filter(c => c.field === 'funding') || [],
            },
            geography: {
              country: rawResult.company?.country || null,
              headquarters: rawResult.company?.headquarters || null,
              city: rawResult.company?.city || null,
              state: rawResult.company?.state || null,
              usPresence: rawResult.company?.usPresence ?? false,
            },
            leadership: {
              ceo: rawResult.leadership?.ceo || null,
              currentCeo: rawResult.leadership?.ceo || null,
              formerCeos: rawResult.leadership?.formerCeos || rawResult.leadership?.former_ceos || [],
              former_ceos: rawResult.leadership?.formerCeos || rawResult.leadership?.former_ceos || [],
              founders: rawResult.leadership?.founders || [],
              coFounders: rawResult.leadership?.coFounders || [],
              co_founders: rawResult.leadership?.coFounders || [],
            },
            contacts: {
              companyEmails: rawResult.contactDetails?.companyEmails || rawResult.contactDetails?.company_emails || [],
              executiveEmails: rawResult.contactDetails?.executiveEmails || rawResult.contactDetails?.executive_emails || [],
              phones: rawResult.contactDetails?.phones || (rawResult.company?.companyPhone ? [rawResult.company.companyPhone] : []),
            },
            social: {
              companyLinkedIn: rawResult.socialDetails?.companyLinkedIn?.url || rawResult.socialDetails?.company_linkedin?.url || rawResult.company?.companyLinkedinUrl || null,
              companyX: rawResult.socialDetails?.companyX?.url || rawResult.socialDetails?.company_x?.url || rawResult.company?.companyTwitterUrl || null,
              executiveProfiles: rawResult.socialDetails?.executiveProfiles || rawResult.socialDetails?.executive_profiles || [],
            },
            fieldCoverage: rawResult.fieldCoverage || rawResult.field_coverage || {},
            evidence: rawResult.evidence || rawResult.evidenceList || [],
            conflicts: rawResult.conflicts || rawResult.conflictDetails?.map(c => `${c.field}: ${c.explanation}`) || [],
            conflictDetails: rawResult.conflictDetails || [],
            researchCompleteness: rawResult.researchCompleteness || rawResult.company?.researchCompleteness || 0,
            qualification: {
              matchScore: rawResult.qualification?.matchScore ?? rawResult.company?.huntScore ?? 0,
              criteria: rawResult.qualification?.criteria || rawResult.criteria,
              finalStatus: rawResult.verificationStatus,
              reasons: rawResult.qualification?.reasons || rawResult.reasons || [],
            },
          };

          // Upsert into unified lead store
          const unifiedLead = unifiedLeadStore.upsertLeadFromExternal(formattedResult, targetProfile.id);
          formattedResult.unified_lead_id = unifiedLead.id;
          formattedResult.origins = unifiedLead.origins;
          formattedResult.originDisplay = unifiedLead.originDisplay;
          formattedResult.statusHistory = unifiedLead.statusHistory;
          formattedResult.auditTrail = unifiedLead.auditTrail;

          verificationResults.push(formattedResult);
        }
      }
    }

    const stats = {
      total: verificationResults.length,
      verified: verificationResults.filter(r => r.verificationStatus === 'VERIFIED').length,
      review: verificationResults.filter(r => r.verificationStatus === 'REVIEW').length,
      unverified: verificationResults.filter(r => r.verificationStatus === 'UNVERIFIED').length,
      rejected: verificationResults.filter(r => r.verificationStatus === 'REJECTED').length,
      // Compatibility aliases
      qualified: verificationResults.filter(r => r.verificationStatus === 'VERIFIED').length,
    };

    return NextResponse.json({
      success: true,
      activeTargetProfileId: targetProfile.id,
      totalRequested: candidatesInput.length,
      results: verificationResults,
      stats,
    });
  } catch (err: any) {
    console.error('[API External Discovery] Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to research external candidate companies',
    }, { status: 500 });
  }
}
