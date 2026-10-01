/**
 * Huntlyst Master Discovery & Orchestration Engine
 * 
 * Executes the unified lead discovery pipeline on Houston agent infrastructure:
 * TARGET -> QUERY PLANNER (8 Strategies) -> HOUSTON DISCOVERY AGENT ->
 * MULTI-SOURCE SEARCH -> DEDUPLICATION & GLOBAL MEMORY ->
 * STAGNATION DETECTION & AUTO-MUTATION ->
 * HOUSTON RESEARCH AGENT -> HOUSTON QUALIFICATION AGENT ->
 * HOUSTON ENRICHMENT AGENT -> HOUSTON VERIFICATION AGENT ->
 * EVIDENCE SCORING -> PERSISTENCE -> HUNTLYST UI STREAMING.
 */

import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE, targetProfileToHuntConfig } from '@/lib/targetProfileData';
import { CompanyRecord, RejectedCompanyRecord, HuntConfig, TVB_EVALUATION_CONFIG, PipelineStreamEvent } from '@/lib/types';
import { QueryPlanner, StrategyPlanItem } from '@/lib/queryPlanner';
import { StagnationDetector, StagnationEvaluation } from '@/lib/stagnationDetector';
import { searchManager } from '@/lib/search/searchManager';
import { checkCompanyDuplicate, extractCanonicalDomain, normalizeCompanyName } from '@/lib/deduplication';
import { dbStore } from '@/lib/db/store';
import { houstonBridge } from '@/lib/houston/runtimeBridge';
import { FounderDiscoveryService } from '@/lib/founderDiscovery';
import { verifyContactLead } from '@/lib/email';
import { calculateHuntScore } from '@/lib/rank';
import { checkFundingRange, checkGeographyMatch, checkNoUSPresence, validateCompany } from '@/lib/validation';
import { mapToStandardIndustry } from '@/lib/discoveryPipeline';
import { ContactEnrichmentService } from '@/lib/contactEnrichment';

export interface DiscoveryEngineOptions {
  sessionId?: string;
  targetCount?: number;
  maxIterations?: number;
  concurrency?: number;
  onEvent?: (event: PipelineStreamEvent) => void;
}

export interface DiscoveryEngineResult {
  sessionId: string;
  qualifiedCompanies: CompanyRecord[];
  rejectedCompanies: RejectedCompanyRecord[];
  totalDiscovered: number;
  totalQualified: number;
  totalRejected: number;
  totalDuplicatesRemoved: number;
  totalNew: number;
  totalPreviouslySeen: number;
  stagnationOccurred: boolean;
  durationMs: number;
  sourcesSearched: string[];
}

export class DiscoveryEngine {
  public static async execute(
    targetInput: TargetProfile | HuntConfig = DEFAULT_TVB_TARGET_PROFILE,
    options: DiscoveryEngineOptions = {}
  ): Promise<DiscoveryEngineResult> {
    const startMs = Date.now();
    const isHuntConfig = 'geography' in targetInput && 'funding' in targetInput && !('fundingMin' in targetInput);
    
    // Normalize target profile & config
    const targetProfile: TargetProfile = isHuntConfig
      ? {
          ...DEFAULT_TVB_TARGET_PROFILE,
          targetCount: (targetInput as HuntConfig).targetLeads || 15,
          countries: (targetInput as HuntConfig).geography.countries,
          regions: (targetInput as HuntConfig).geography.regions,
          excludedCountries: (targetInput as HuntConfig).geography.excludedCountries,
          usPresenceMode: ((targetInput as HuntConfig).geography.usPresence as any) || 'minimal_or_none',
          fundingMin: (targetInput as HuntConfig).funding.min,
          fundingMax: (targetInput as HuntConfig).funding.max,
          industries: (targetInput as HuntConfig).sectors,
          subIndustries: (targetInput as HuntConfig).businessModels,
          companyStages: (targetInput as HuntConfig).stage,
        }
      : (targetInput as TargetProfile);

    const config: HuntConfig = isHuntConfig
      ? (targetInput as HuntConfig)
      : targetProfileToHuntConfig(targetProfile);

    const targetLeads = options.targetCount ||
      (typeof targetProfile.targetCount === 'number'
        ? targetProfile.targetCount
        : targetProfile.customTargetCount || 15);

    const sessionId = options.sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const session = dbStore.getOrCreateSession(sessionId, targetProfile, targetLeads);

    const emit = (event: Partial<PipelineStreamEvent>) => {
      if (options.onEvent) {
        options.onEvent({
          type: event.type || 'log',
          timestamp: new Date().toISOString(),
          message: event.message || '',
          stage: event.stage,
          stageName: event.stageName,
          huntId: sessionId,
          stats: event.stats,
          company: event.company,
          result: event.result,
          error: event.error,
        });
      }
    };

    emit({
      type: 'log',
      message: `[Huntlyst Engine] Initializing search session '${sessionId}' on Houston runtime (Target: ${targetLeads} leads)...`,
      stage: 0,
      stageName: 'Initialization',
    });

    const sessionSeenDomains = new Set<string>();
    const sessionSeenFingerprints = new Set<string>();
    const allQualified: CompanyRecord[] = [];
    const allRejected: RejectedCompanyRecord[] = [];
    const allSourcesSearched = new Set<string>();

    let currentStrategyIndex = 1;
    let currentPage = 1;
    let consecutiveStagnantRounds = 0;
    let stagnationOccurred = false;
    let iteration = 0;
    const maxIterations = options.maxIterations || Math.max(12, Math.ceil(targetLeads * 1.2));
    let totalDiscoveredGlobal = 0;
    let totalDuplicatesGlobal = 0;
    let totalNewGlobal = 0;
    let totalPreviouslySeenGlobal = 0;

    // =========================================================================
    // ITERATIVE MULTI-STRATEGY DISCOVERY LOOP
    // =========================================================================
    while (allQualified.length < targetLeads && iteration < maxIterations) {
      iteration++;

      // 1. Generate diversified query plan for the active strategy
      const strategyPlans = QueryPlanner.generateStrategyPlans(targetProfile, currentStrategyIndex - 1, currentPage);
      const activePlan = strategyPlans[0];

      emit({
        type: 'log',
        message: `Executing ${activePlan.strategyName} (Round ${iteration}/${maxIterations}, Page ${currentPage})...`,
        stage: 1,
        stageName: 'Discovering',
      });

      // 2. Run Houston Discovery Agent turn
      let candidateBatch: any[] = [];
      try {
        const { output } = await houstonBridge.executeTurn(
          'huntlyst-discovery',
          sessionId,
          { plan: activePlan, targetLeads },
          async ({ log, recordToolCall }) => {
            log(`Running multi-source search for query: "${activePlan.query}"`);
            const searchStart = Date.now();

            const searchRes = await searchManager.multiSourceSearch(activePlan.query, {
              page: activePlan.page,
              pageSize: 12,
              geoTarget: activePlan.geoTarget,
              strategyName: activePlan.strategyName,
              excludeDomains: Array.from(sessionSeenDomains),
            });

            recordToolCall('searchManager.multiSourceSearch', { query: activePlan.query }, searchRes, Date.now() - searchStart);
            log(`Search yielded ${searchRes.candidates.length} candidates from ${searchRes.sourcesSearched.join(', ')}`);
            searchRes.sourcesSearched.forEach(s => allSourcesSearched.add(s));
            return searchRes.candidates;
          }
        );
        candidateBatch = output || [];
      } catch (err: any) {
        emit({
          type: 'log',
          message: `Discovery turn error: ${err.message || 'Unknown error'}. Continuing to next strategy.`,
          stage: 1,
          stageName: 'Discovering',
        });
      }

      totalDiscoveredGlobal += candidateBatch.length;

      // 3. Multi-Level Deduplication & Identity Resolution
      const freshCandidates: any[] = [];
      let roundDuplicates = 0;

      for (const cand of candidateBatch) {
        const dupeCheck = checkCompanyDuplicate(cand.name, cand.url, sessionSeenDomains, sessionSeenFingerprints);

        if (dupeCheck.isDuplicate) {
          roundDuplicates++;
          totalDuplicatesGlobal++;
        } else {
          sessionSeenDomains.add(dupeCheck.canonicalDomain);
          sessionSeenFingerprints.add(dupeCheck.fingerprint);
          dbStore.markDomainSeen(dupeCheck.canonicalDomain, dupeCheck.fingerprint);

          const isNewCandidate = !dupeCheck.isPreviouslySeen;
          if (isNewCandidate) {
            totalNewGlobal++;
          } else {
            totalPreviouslySeenGlobal++;
          }

          dbStore.recordResult({
            id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            sessionId,
            rawUrl: cand.url,
            canonicalDomain: dupeCheck.canonicalDomain,
            normalizedName: dupeCheck.normalizedName,
            fingerprint: dupeCheck.fingerprint,
            title: cand.name,
            snippet: cand.snippet,
            source: cand.source,
            isNew: isNewCandidate,
            discoveredAt: new Date().toISOString(),
          });

          freshCandidates.push({
            ...cand,
            statusTag: isNewCandidate ? 'NEW' : 'PREVIOUSLY_DISCOVERED',
            canonicalDomain: dupeCheck.canonicalDomain,
            normalizedName: dupeCheck.normalizedName,
            isPreviouslySeen: dupeCheck.isPreviouslySeen,
          });
        }
      }

      emit({
        type: 'candidate_found',
        message: `Found ${candidateBatch.length} candidates (${freshCandidates.length} eligible, ${roundDuplicates} duplicates/invalid filtered).`,
        stage: 1,
        stageName: 'Discovering',
        stats: {
          discovered: totalDiscoveredGlobal,
          extracted: freshCandidates.length,
          nonUsPassed: 0,
          fundingQualified: 0,
          founderFound: 0,
          emailVerified: 0,
          finalRanked: allQualified.length,
          durationMs: Date.now() - startMs,
          totalNew: totalNewGlobal,
          totalPreviouslySeen: totalPreviouslySeenGlobal,
          duplicatesRemoved: totalDuplicatesGlobal,
        },
      });

      // 4. Stagnation Detection & Automatic Mutation
      const stagnationEval = StagnationDetector.evaluate(
        candidateBatch.length,
        freshCandidates.length,
        consecutiveStagnantRounds,
        currentStrategyIndex,
        currentPage,
        allQualified.length,
        targetLeads,
        iteration
      );

      consecutiveStagnantRounds = stagnationEval.consecutiveStagnantCount;

      if (stagnationEval.isStagnant) {
        stagnationOccurred = true;
        emit({
          type: 'log',
          message: `[Stagnation Guard] ${stagnationEval.reason} Automatically mutating strategy and advancing cursor.`,
          stage: 1,
          stageName: 'Discovering',
        });

        if (stagnationEval.mutationAction === 'stop_condition_met') {
          break;
        }

        if (stagnationEval.nextStrategyIndex) {
          currentStrategyIndex = stagnationEval.nextStrategyIndex;
        }
        if (stagnationEval.newPage) {
          currentPage = stagnationEval.newPage;
        }
      } else {
        // Advance strategy organically
        currentStrategyIndex = (currentStrategyIndex % 8) + 1;
      }

      // If no fresh candidates in this round, continue to next iteration
      if (freshCandidates.length === 0) {
        continue;
      }

      // =======================================================================
      // RESEARCH, QUALIFICATION, ENRICHMENT & VERIFICATION FOR CANDIDATES
      // =======================================================================
      for (const cand of freshCandidates) {
        if (allQualified.length >= targetLeads) break;

        emit({
          type: 'log',
          message: `Researching candidate "${cand.name}" (${cand.url})...`,
          stage: 2,
          stageName: 'Researching',
        });

        // Houston Research & Qualification
        const industryMapping = mapToStandardIndustry(cand.detectedIndustry, cand.snippet);

        // Deterministic Geography Check
        const geoResult = checkGeographyMatch(cand.snippet, cand.url, config);
        const usPresenceVerdict = checkNoUSPresence(
          cand.snippet,
          cand.url,
          (config.geography.usPresence as any) || 'minimal_or_none'
        );
        const usPresencePassed = usPresenceVerdict !== true; // true means US presence was detected (fails)

        // Deterministic Funding Check
        const fundingResult = checkFundingRange(
          cand.detectedFunding || cand.snippet,
          targetProfile.fundingMin || config.funding.min,
          targetProfile.fundingMax || config.funding.max
        );

        const isGeoPassed = geoResult.passed && usPresencePassed;
        const isFundingPassed = fundingResult.passed;
        const isTechPassed = industryMapping.standard_industry !== 'Other / Custom' ||
          /software|platform|saas|ai|cloud|api|app|tech/i.test(cand.snippet);

        // Qualification Gate
        if (!isGeoPassed || !isFundingPassed || !isTechPassed) {
          const reasons: string[] = [];
          if (!geoResult.passed) reasons.push(`Geography outside targeted bounds: ${geoResult.reason || 'Country/Region mismatch'}`);
          if (!usPresencePassed) reasons.push(`US Presence policy violated: US presence identified`);
          if (!isFundingPassed) reasons.push(`Funding criteria not met: ${fundingResult.reason}`);
          if (!isTechPassed) reasons.push(`Industry taxonomy rejected: ${industryMapping.raw_industry} is not an eligible tech platform`);

          allRejected.push({
            name: cand.name,
            website: cand.url,
            industry: industryMapping.standard_industry,
            fundingOrRevenue: cand.detectedFunding || 'Unconfirmed',
            location: cand.detectedCountry || 'Unspecified',
            rejectionReasons: reasons,
            matchedRules: isFundingPassed ? ['✓ Funding threshold satisfied'] : [],
            failedRules: reasons.map(r => `✗ ${r}`),
            sourceEvidence: cand.snippet,
          });

          continue;
        }

        // =====================================================================
        // HOUSTON ENRICHMENT AGENT: FOUNDER DISCOVERY
        // =====================================================================
        emit({
          type: 'log',
          message: `Finding verified founders and decision-makers for "${cand.name}"...`,
          stage: 4,
          stageName: 'Finding Founders',
        });

        // =====================================================================
        // HOUSTON ENRICHMENT AGENT: DECISION-MAKER & CONTACT ENRICHMENT
        // =====================================================================
        emit({
          type: 'log',
          message: `Enriching contact profile & discovering decision-makers for "${cand.name}"...`,
          stage: 4,
          stageName: 'Finding Founders',
        });

        const contactProfile = await ContactEnrichmentService.enrichCompanyContacts({
          companyName: cand.name,
          website: cand.url,
          description: cand.snippet,
          industry: industryMapping.standard_industry,
          country: cand.detectedCountry,
          rawSnippet: cand.snippet,
        });

        const primaryContact = contactProfile.primary_contact;
        const founderName = primaryContact?.full_name || null;
        const founderTitle = primaryContact?.current_role ? `${primaryContact.current_role}` : 'CEO / Founder';
        const professionalEmail = primaryContact?.professional_email || contactProfile.company_email.value;
        const isEmailVerified = primaryContact?.professional_email_status === 'VALID' || contactProfile.company_email.verification_status === 'VERIFIED';

        // =====================================================================
        // HOUSTON VERIFICATION AGENT: EMAIL & DNS MX VERIFICATION
        // =====================================================================
        emit({
          type: 'log',
          message: `Verifying contact deliverability & DNS MX records for "${cand.name}"...`,
          stage: 5,
          stageName: 'Verifying Contacts',
        });

        const contactRes = await verifyContactLead({
          companyName: cand.name,
          companyWebsite: cand.url,
          leadName: founderName,
          roleTitle: founderTitle,
          email: professionalEmail,
          sourceUrls: [cand.url],
        });

        const now = new Date().toISOString();
        const record: CompanyRecord = {
          name: cand.name,
          website: cand.url,
          description: cand.snippet,
          industry: industryMapping.standard_industry,
          fundingOrRevenue: cand.detectedFunding || 'Seed / Series A',
          usPresence: usPresencePassed,
          founderOrCeoName: founderName,
          founderOrCeoEmail: contactRes.email || professionalEmail,
          emailVerified: isEmailVerified || contactRes.verified,
          contactVerificationStatus: isEmailVerified ? 'VERIFIED' : contactRes.verificationStatus,
          contactVerificationReason: contactProfile.best_contact_path.explanation || contactRes.reason,
          confidenceScore: primaryContact?.confidence || 80,
          sourceType: cand.source || 'Huntlyst Discovery',
          country: cand.detectedCountry || 'Europe',
          headquarters: cand.detectedCountry || 'Europe',
          linkedinUrl: primaryContact?.linkedin_url || null,
          companyLinkedinUrl: contactProfile.company_linkedin.value || null,
          sourceUrls: [cand.url],
          statusTag: (cand.statusTag as 'NEW' | 'PREVIOUSLY_DISCOVERED') || 'NEW',
          firstDiscoveredAt: now,
          lastSeenAt: now,
          lastVerifiedAt: now,
          contactProfile,
          evidence: {
            fundingSource: cand.snippet,
            techEvidence: `Verified platform: ${industryMapping.standard_industry}`,
            geoEvidence: geoResult.reason || `Confirmed location in target region`,
            founderSource: primaryContact?.company_relationship || 'Public company disclosures',
            emailVerificationDetail: contactRes.evidence,
            sources: [cand.url],
          },
        };

        const huntScoreRes = calculateHuntScore(record, config);
        record.huntScore = huntScoreRes.score;
        record.scoreBreakdown = huntScoreRes.breakdown;


        allQualified.push(record);

        emit({
          type: 'company_qualified',
          message: `Qualified lead #${allQualified.length}: ${record.name} (Score: ${record.huntScore}/100) [${record.statusTag}]`,
          stage: 6,
          stageName: 'Qualifying',
          company: record,
        });
      }
    }

    // Sort qualified companies: prioritize fresh NEW leads first, then by huntScore descending
    allQualified.sort((a, b) => {
      if (a.statusTag === 'NEW' && b.statusTag !== 'NEW') return -1;
      if (a.statusTag !== 'NEW' && b.statusTag === 'NEW') return 1;
      return (b.huntScore || 0) - (a.huntScore || 0);
    });

    // Update persistent search session metrics
    dbStore.updateSession(sessionId, {
      status: 'completed',
      alreadyFoundCount: totalDiscoveredGlobal,
      qualifiedCount: allQualified.length,
      rejectedCount: allRejected.length,
      duplicatesRemovedCount: totalDuplicatesGlobal,
      sourcesSearched: Array.from(allSourcesSearched),
      stagnationCounter: consecutiveStagnantRounds,
    });

    // Record session history item
    dbStore.recordHistory({
      id: `hist_${sessionId}`,
      sessionId,
      timestamp: new Date().toISOString(),
      targetSummary: `${targetProfile.industries?.join(', ') || 'Tech'} in ${targetProfile.countries?.join(', ') || targetProfile.regions?.join(', ') || 'Global'}`,
      targetLeads,
      qualifiedCount: allQualified.length,
      rejectedCount: allRejected.length,
      durationSeconds: Math.round((Date.now() - startMs) / 1000),
      status: allQualified.length >= targetLeads ? 'Completed' : 'Degraded',
      companies: allQualified,
    });

    const durationMs = Date.now() - startMs;
    const stopReason = allQualified.length >= targetLeads
      ? `Target of ${targetLeads} qualified leads satisfied.`
      : stagnationOccurred
      ? `${allQualified.length} unique qualified leads found. Additional searches produced mostly duplicate or low-confidence results across searched sources.`
      : `${allQualified.length} unique qualified leads found after searching available sources (${totalDuplicatesGlobal} duplicates prevented).`;

    emit({
      type: 'complete',
      message: `Discovery complete in ${(durationMs / 1000).toFixed(1)}s: ${stopReason}`,
      stage: 7,
      stageName: 'Completed',
    });

    return {
      sessionId,
      qualifiedCompanies: allQualified,
      rejectedCompanies: allRejected,
      totalDiscovered: totalDiscoveredGlobal,
      totalQualified: allQualified.length,
      totalRejected: allRejected.length,
      totalDuplicatesRemoved: totalDuplicatesGlobal,
      totalNew: totalNewGlobal,
      totalPreviouslySeen: totalPreviouslySeenGlobal,
      stagnationOccurred,
      durationMs,
      sourcesSearched: Array.from(allSourcesSearched),
    };
  }
}
