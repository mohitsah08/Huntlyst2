/**
 * Firecrawl Candidate Discovery Engine
 * 
 * Powered by QueryPlanner and Firecrawl Search API:
 * - Employs multi-strategy query synthesis for venture discovery
 * - Deduplicates results against seen domains and internal fingerprint store
 * - Normalizes Firecrawl search outputs into standard ProviderSearchResult objects
 */

import { TargetProfile, DEFAULT_TVB_TARGET_PROFILE } from '@/lib/targetProfileData';
import { HuntConfig } from '@/lib/types';
import { ProviderSearchResult } from '../types';
import { QueryPlanner } from '@/lib/queryPlanner';
import { firecrawlClient } from './client';
import { extractCanonicalDomain, checkCompanyDuplicate } from '@/lib/deduplication';
import { dbStore } from '@/lib/db/store';

let firecrawlSearchCursor = 0;

export async function searchCandidatesWithFirecrawl(
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
  const strategies = QueryPlanner.generateStrategyPlans(targetProfile, firecrawlSearchCursor, 1);
  firecrawlSearchCursor = (firecrawlSearchCursor + 1) % 8;

  // If Firecrawl is not configured, return empty array safely without throwing
  if (!firecrawlClient.isConfigured()) {
    console.warn('[FirecrawlSearcher] FIRECRAWL_API_KEY not configured. Skipping Firecrawl candidate search.');
    return [];
  }

  for (const plan of strategies) {
    if (candidates.length >= count) break;

    try {
      const searchRes = await firecrawlClient.search(plan.query, {
        limit: Math.min(count * 2, 10),
      });

      if (!searchRes.success || !searchRes.data) continue;

      const rawItems = Array.isArray(searchRes.data)
        ? searchRes.data
        : (searchRes.data.web || []);

      for (const item of rawItems) {
        if (candidates.length >= count) break;
        if (!item.url || !item.url.startsWith('http')) continue;

        const candidateName = item.title?.split(/[-–|:]/)[0].trim() || extractCanonicalDomain(item.url);
        const dupeCheck = checkCompanyDuplicate(candidateName, item.url, excludedSet);

        if (!dupeCheck.isDuplicate) {
          excludedSet.add(dupeCheck.canonicalDomain);
          dbStore.markDomainSeen(dupeCheck.canonicalDomain, dupeCheck.fingerprint);

          candidates.push({
            name: candidateName,
            url: item.url,
            snippet: item.description || item.markdown?.slice(0, 200) || `${candidateName} venture entity`,
            source: 'Firecrawl Search',
            detectedCountry: plan.geoTarget || undefined,
            detectedIndustry: targetProfile.industries?.[0] || undefined,
          });
        }
      }
    } catch (err: any) {
      console.warn(`[FirecrawlSearcher] Strategy ${plan.strategyName} error:`, err?.message || err);
    }
  }

  return candidates.slice(0, count);
}
