/**
 * Target-Driven Discovery Engine & Query Planner
 * 
 * Implements the 8 core discovery strategies:
 * Strategy 1: Industry + Geography
 * Strategy 2: Funding Signals + Geography
 * Strategy 3: Hiring / Growth Signals
 * Strategy 4: Technology / Platform Signals
 * Strategy 5: Alternative Industry Terminology & Synonyms
 * Strategy 6: Company Directories & Ecosystem Registries
 * Strategy 7: Web Research Queries & Venture Dispatches
 * Strategy 8: Country / Region Specific Sources
 */

import { TargetProfile } from '@/lib/targetProfileData';
import { HuntConfig } from '@/lib/types';

export interface StrategyPlanItem {
  strategyIndex: number;
  strategyName: string;
  query: string;
  targetSources: string[];
  page: number;
  geoTarget?: string;
}

// Synonyms and alternative terms for venture verticals
const INDUSTRY_SYNONYM_MAP: Record<string, string[]> = {
  saas: ['cloud software', 'b2b platform', 'enterprise workflow', 'api platform', 'software as a service'],
  ai: ['machine learning', 'artificial intelligence', 'llm', 'genai', 'neural platform', 'computer vision'],
  fintech: ['payments infrastructure', 'digital banking', 'treasury management', 'wealthtech', 'insurtech', 'embedded finance'],
  cybersecurity: ['infosec', 'cloud security', 'identity access management', 'threat intelligence', 'zero trust'],
  healthtech: ['digital health', 'telehealth', 'clinical software', 'biotech platform', 'medical devices'],
  cleantech: ['climate tech', 'sustainability software', 'carbon accounting', 'renewable energy', 'solar software'],
  logistics: ['supply chain tech', 'freight forwarding platform', 'warehouse automation', 'last mile delivery'],
  ecommerce: ['d2c tech', 'retail tech', 'omnichannel commerce', 'marketplace platform'],
  developer: ['devops', 'developer tools', 'api infrastructure', 'observability platform', 'kubernetes'],
};

export class QueryPlanner {
  public static generateStrategyPlans(
    target: TargetProfile | HuntConfig,
    iteration: number = 0,
    page: number = 1
  ): StrategyPlanItem[] {
    const isHunt = 'geography' in target && 'funding' in target && !('fundingMin' in target);

    const countries = isHunt
      ? (target as HuntConfig).geography.countries || []
      : (target as TargetProfile).countries || [];

    const regions = isHunt
      ? (target as HuntConfig).geography.regions || []
      : (target as TargetProfile).regions || [];

    const excluded = isHunt
      ? (target as HuntConfig).geography.excludedCountries || []
      : (target as TargetProfile).excludedCountries || [];

    const industries = (
      isHunt
        ? (target as HuntConfig).sectors || []
        : (target as TargetProfile).industries || []
    ).filter(i => i !== 'all' && i !== 'All sectors' && i !== 'Any');

    const subIndustries = isHunt
      ? (target as HuntConfig).businessModels || []
      : (target as TargetProfile).subIndustries || [];

    const minFunding = isHunt
      ? (target as HuntConfig).funding.min || 1_000_000
      : (target as TargetProfile).fundingMin || 1_000_000;

    const maxFunding = isHunt
      ? (target as HuntConfig).funding.max || 5_000_000
      : (target as TargetProfile).fundingMax || 5_000_000;

    const currency = isHunt ? 'USD' : (target as TargetProfile).fundingCurrency || 'USD';
    const usMode = isHunt ? (target as HuntConfig).geography.usPresence : (target as TargetProfile).usPresenceMode;

    // Build exclusion keywords
    let excludePart = '';
    if (excluded.includes('United States') || usMode === 'strictly_none' || usMode === 'minimal_or_none') {
      excludePart = '-US -USA -America -"San Francisco" -"New York"';
    }
    for (const ex of excluded) {
      if (ex !== 'United States') excludePart += ` -"${ex}"`;
    }

    // Determine primary geo label
    let geoLabel = 'Europe';
    if (countries.length > 0) {
      geoLabel = countries.slice(0, 3).map(c => `"${c}"`).join(' OR ');
    } else if (regions.length > 0 && !regions.includes('Global')) {
      geoLabel = regions.slice(0, 2).map(r => `"${r}"`).join(' OR ');
    }

    // Determine primary sector terms
    let primarySector = industries.length > 0 ? industries[0] : 'SaaS';
    let sectorTerms = industries.length > 0 ? industries.join(' OR ') : 'SaaS OR "B2B Software"';
    if (subIndustries.length > 0) {
      sectorTerms += ` OR ${subIndustries.slice(0, 2).map(s => `"${s}"`).join(' OR ')}`;
    }

    // Funding clause
    const minM = (minFunding / 1e6).toFixed(0);
    const maxM = (maxFunding / 1e6).toFixed(0);
    const fundingClause = currency === 'INR'
      ? '("crore" OR "seed" OR "series A") raised funding'
      : `("$${minM}M" OR "$${maxM}M" OR "million") seed OR "series A" funding`;

    // Strategy 5: Synonyms
    let synonymQuery = sectorTerms;
    const lowerSec = primarySector.toLowerCase();
    for (const [key, synonyms] of Object.entries(INDUSTRY_SYNONYM_MAP)) {
      if (lowerSec.includes(key)) {
        synonymQuery = synonyms.slice(0, 3).map(s => `"${s}"`).join(' OR ');
        break;
      }
    }

    // Curate the 8 strategies
    const plans: StrategyPlanItem[] = [
      // 1. Industry + Geography
      {
        strategyIndex: 1,
        strategyName: 'Strategy 1: Industry + Geography Direct Search',
        query: `(${sectorTerms}) (${geoLabel}) startup company website ${excludePart}`,
        targetSources: ['Claude Venture Intelligence', 'DuckDuckGo Open Web', 'Curated Venture Directory'],
        page,
      },
      // 2. Funding Signals + Geography
      {
        strategyIndex: 2,
        strategyName: 'Strategy 2: Venture Capital & Funding Signals',
        query: `(${sectorTerms}) (${geoLabel}) ${fundingClause} ${excludePart}`,
        targetSources: ['Venture Funding Wires', 'Claude Venture Intelligence', 'Google Search (SerpAPI)'],
        page,
      },
      // 3. Hiring & Team Expansion Signals
      {
        strategyIndex: 3,
        strategyName: 'Strategy 3: Hiring & Scale Signals',
        query: `(${sectorTerms}) (${geoLabel}) "careers" OR "we are hiring" "our team" ${excludePart}`,
        targetSources: ['DuckDuckGo Open Web', 'Google Search (SerpAPI)'],
        page,
      },
      // 4. Technology & Platform Signals
      {
        strategyIndex: 4,
        strategyName: 'Strategy 4: Platform Architecture & Technology Signals',
        query: `(${sectorTerms}) (${geoLabel}) "API documentation" OR "cloud platform" OR "enterprise pricing" ${excludePart}`,
        targetSources: ['Claude Venture Intelligence', 'DuckDuckGo Open Web'],
        page,
      },
      // 5. Alternative Industry Terminology & Synonyms
      {
        strategyIndex: 5,
        strategyName: 'Strategy 5: Taxonomy Expansion & Synonyms',
        query: `(${synonymQuery}) (${geoLabel}) tech startup ${excludePart}`,
        targetSources: ['Claude Venture Intelligence', 'Curated Venture Directory'],
        page,
      },
      // 6. Company Directories & Registries
      {
        strategyIndex: 6,
        strategyName: 'Strategy 6: Ecosystem Directories & Registries',
        query: `(site:dealroom.co OR site:pitchbook.com OR site:crunchbase.com) (${sectorTerms}) (${geoLabel}) ${excludePart}`,
        targetSources: ['Google Search (SerpAPI)', 'DuckDuckGo Open Web'],
        page,
      },
      // 7. Venture Media & Startup Dispatches
      {
        strategyIndex: 7,
        strategyName: 'Strategy 7: Venture News & Editorial Dispatches',
        query: `(site:eu-startups.com OR site:tech.eu OR site:inc42.com OR site:techinasia.com) (${sectorTerms}) "seed" OR "raised" ${excludePart}`,
        targetSources: ['Venture Funding Wires', 'DuckDuckGo Open Web'],
        page,
      },
      // 8. Regional & Country Ecosystem Wires
      {
        strategyIndex: 8,
        strategyName: 'Strategy 8: Country-Specific Ecosystem Focus',
        query: `("${geoLabel.replace(/"/g, '')}") top (${sectorTerms}) startup founders "headquartered in" ${excludePart}`,
        targetSources: ['Claude Venture Intelligence', 'Curated Venture Directory', 'DuckDuckGo Open Web'],
        page,
      },
    ];

    // Rotate strategies based on iteration so subsequent passes test different strategies
    const rotated = [...plans.slice(iteration % plans.length), ...plans.slice(0, iteration % plans.length)];
    return rotated;
  }
}
