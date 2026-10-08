/**
 * Venture Search Discovery Engine
 * 
 * Powered by QueryPlanner, multi-source search providers, and deduplication memory.
 * Eliminates repetitive search results by rotating through the 8 discovery strategies,
 * filtering against global previously seen domains, and querying across multiple sources.
 */

import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';
import { HuntConfig } from '@/lib/types';
import { ProviderSearchResult } from '../types';
import { QueryPlanner } from '@/lib/queryPlanner';
import { searchManager } from '@/lib/search/searchManager';
import { extractCanonicalDomain, checkCompanyDuplicate } from '@/lib/deduplication';
import { dbStore } from '@/lib/db/store';

let searchIterationCursor = 0;

export async function searchCandidatesWithClaude(
  target: TargetProfile | HuntConfig,
  count: number = 10,
  excludeDomains: string[] = []
): Promise<ProviderSearchResult[]> {
  const isHuntConfig = 'geography' in target && 'funding' in target && !('fundingMin' in target);

  const targetProfile: TargetProfile = isHuntConfig
    ? {
        ...DEFAULT_TVB_TARGET_PROFILE,
        countries: (target as HuntConfig).geography.countries,
        regions: (target as HuntConfig).geography.regions,
        excludedCountries: (target as HuntConfig).geography.excludedCountries,
        usPresenceMode: (target as HuntConfig).geography.usPresence as any,
        fundingMin: (target as HuntConfig).funding.min,
        fundingMax: (target as HuntConfig).funding.max,
        industries: (target as HuntConfig).sectors,
        subIndustries: (target as HuntConfig).businessModels,
        companyStages: (target as HuntConfig).stage,
        targetCount: count,
      }
    : (target as TargetProfile);

  const excludedSet = new Set(excludeDomains.map((d) => extractCanonicalDomain(d)));
  const candidates: ProviderSearchResult[] = [];

  // Generate diversified strategy plans
  const strategies = QueryPlanner.generateStrategyPlans(targetProfile, searchIterationCursor, 1);
  searchIterationCursor = (searchIterationCursor + 1) % 8;

  // Try strategies until we gather enough candidates
  for (const plan of strategies) {
    if (candidates.length >= count) break;

    try {
      const searchRes = await searchManager.multiSourceSearch(plan.query, {
        page: plan.page,
        pageSize: count,
        geoTarget: plan.geoTarget,
        strategyName: plan.strategyName,
        excludeDomains: Array.from(excludedSet),
      });

      for (const item of searchRes.candidates) {
        if (candidates.length >= count) break;
        const dupeCheck = checkCompanyDuplicate(item.name, item.url, excludedSet);

        if (!dupeCheck.isDuplicate) {
          excludedSet.add(dupeCheck.canonicalDomain);
          dbStore.markDomainSeen(dupeCheck.canonicalDomain, dupeCheck.fingerprint);

          candidates.push({
            name: item.name,
            url: item.url,
            snippet: item.snippet,
            source: item.source || plan.strategyName,
            detectedCountry: item.detectedCountry || undefined,
            detectedIndustry: item.detectedIndustry || undefined,
          });
        }
      }
    } catch (err) {
      console.warn(`[VentureSearcher] Strategy ${plan.strategyName} error:`, err);
    }
  }

  return candidates.slice(0, count);
}
