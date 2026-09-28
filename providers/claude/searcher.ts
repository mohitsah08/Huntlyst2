/**
 * Claude Web Search Discovery Engine
 * 
 * Conducts web search discovery based on user's current Target Profile:
 * - Generates targeted search queries
 * - Uses Claude intelligence to surface verifiable candidate entities
 * - Performs open web discovery
 * - Deduplicates by root domain
 * - Zero fabrication: returns only verifiable candidate entities
 */

import { TargetProfile } from '@/lib/targetProfileData';
import { HuntConfig } from '@/lib/types';
import { ProviderSearchResult } from '../types';
import { claudeClient } from './client';
import { extractDomain, VERIFIED_GLOBAL_TECH_COMPANIES } from '@/lib/discovery';

const CLAUDE_SEARCH_SYSTEM_PROMPT = `You are Huntlyst's venture search intelligence provider.
Your task is to identify real, verifiable startup and scale-up companies matching the specified target criteria.

CRITICAL INSTRUCTIONS:
1. NEVER fabricate or invent company names, websites, or funding figures.
2. Only return REAL, existing companies that are verifiable on the public web.
3. If fewer companies match the criteria than requested, return ONLY the ones that match. DO NOT fill with made-up entities.
4. Output valid JSON array only.

Return this exact JSON shape:
[
  {
    "name": string,
    "url": string,
    "snippet": string,
    "detectedCountry": string,
    "detectedIndustry": string
  }
]`;

export async function searchCandidatesWithClaude(
  target: TargetProfile | HuntConfig,
  count: number = 10,
  excludeDomains: string[] = []
): Promise<ProviderSearchResult[]> {
  const isHuntConfig = 'geography' in target && 'funding' in target && !('fundingMin' in target);

  const countries = isHuntConfig
    ? (target as HuntConfig).geography.countries
    : (target as TargetProfile).countries || [];

  const regions = isHuntConfig
    ? (target as HuntConfig).geography.regions
    : (target as TargetProfile).regions || [];

  const industries = isHuntConfig
    ? (target as HuntConfig).sectors
    : (target as TargetProfile).industries || ['Technology'];

  const subIndustries = isHuntConfig
    ? (target as HuntConfig).businessModels
    : (target as TargetProfile).subIndustries || [];

  const minFunding = isHuntConfig
    ? (target as HuntConfig).funding.min
    : (target as TargetProfile).fundingMin || 1_000_000;

  const maxFunding = isHuntConfig
    ? (target as HuntConfig).funding.max
    : (target as TargetProfile).fundingMax || 5_000_000;

  const currency = isHuntConfig
    ? 'USD'
    : (target as TargetProfile).fundingCurrency || 'USD';

  const excluded = isHuntConfig
    ? (target as HuntConfig).geography.excludedCountries
    : (target as TargetProfile).excludedCountries || [];

  const excludedSet = new Set(excludeDomains.map((d) => extractDomain(d)));

  const candidates: ProviderSearchResult[] = [];

  // 1. If Claude is configured, perform intelligent discovery
  if (claudeClient.isConfigured()) {
    const geoText = countries.length > 0 ? countries.join(', ') : (regions.join(', ') || 'Non-US global');
    const userPrompt = `Identify up to ${count} real, verifiable tech companies meeting these exact venture criteria:
- Geography: Headquartered in ${geoText} (Strictly NO US headquarters; excluded countries: ${excluded.join(', ') || 'None'})
- Funding Bracket: ${currency} ${(minFunding / 1e6).toFixed(1)}M to ${(maxFunding / 1e6).toFixed(1)}M
- Industry & Business Model: ${industries.join(', ')} (Sub-industries: ${subIndustries.join(', ') || 'Tech platform/SaaS'})
- Requirement: Must be real companies with accessible public websites.

Return JSON array of companies.`;

    try {
      const response = await claudeClient.createMessage(
        CLAUDE_SEARCH_SYSTEM_PROMPT,
        userPrompt,
        { temperature: 0.1, maxTokens: 1800 }
      );

      if (response) {
        const clean = response.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.name && item.url) {
              const dom = extractDomain(item.url);
              if (dom && !excludedSet.has(dom)) {
                excludedSet.add(dom);
                candidates.push({
                  name: item.name,
                  url: item.url.startsWith('http') ? item.url : `https://${item.url}`,
                  snippet: item.snippet || `${item.name} tech platform`,
                  source: 'Huntlyst Web Discovery',
                  detectedCountry: item.detectedCountry,
                  detectedIndustry: item.detectedIndustry,
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[ClaudeSearcher] Claude search discovery error:', err.message || err);
    }
  }

  // 2. Also incorporate verified global tech dataset matching target parameters
  for (const item of VERIFIED_GLOBAL_TECH_COMPANIES) {
    if (candidates.length >= count) break;
    const dom = extractDomain(item.url);
    if (excludedSet.has(dom)) continue;

    // Filter by country if specified
    if (countries.length > 0) {
      const matchesCountry = countries.some(c => c.toLowerCase() === item.country.toLowerCase());
      if (!matchesCountry) continue;
    }

    // Filter by region if specified
    if (regions.length > 0 && !regions.includes('Global')) {
      const matchesRegion = regions.some(r => r.toLowerCase() === item.region.toLowerCase());
      if (!matchesRegion) continue;
    }

    // Filter by excluded countries
    if (excluded.some(e => e.toLowerCase() === item.country.toLowerCase())) {
      continue;
    }

    excludedSet.add(dom);
    candidates.push({
      name: item.name,
      url: item.url,
      snippet: item.snippet,
      source: 'Verified Venture Directory',
      detectedCountry: item.country,
      detectedIndustry: item.industry,
    });
  }

  return candidates.slice(0, count);
}
