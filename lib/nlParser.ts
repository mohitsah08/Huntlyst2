/**
 * Natural Language Hunt Parser
 * Converts plain English search prompts into structured HuntConfig filters.
 */

import { HuntConfig, TVB_EVALUATION_CONFIG } from './types';
import { COUNTRIES, REGION_PRESETS, findCountry } from './geography';

export interface ParsedHuntResult {
  config: HuntConfig;
  detectedSummary: {
    countries: string[];
    regions: string[];
    excludedCountries: string[];
    sectors: string[];
    fundingMin?: number;
    fundingMax?: number;
    fundingText?: string;
    stages: string[];
    companySize?: string[];
    usPresence?: string;
    contact?: string;
  };
  confidence: number;
  rawQuery: string;
}

const SECTOR_PATTERNS: Record<string, RegExp> = {
  AI: /\b(ai|artificial intelligence|machine learning|genai|llm|deep learning)\b/i,
  SaaS: /\b(saas|software-as-a-service|b2b software|cloud software)\b/i,
  Fintech: /\b(fintech|payments|banking|defi|crypto|wealthtech|lending|financial tech)\b/i,
  Cybersecurity: /\b(cybersecurity|security|infosec|cloud security|zero trust)\b/i,
  HealthTech: /\b(healthtech|medtech|biotech|digital health|clinical)\b/i,
  EdTech: /\b(edtech|education tech|learning platform|e-learning)\b/i,
  TravelTech: /\b(traveltech|hospitality tech|booking platform)\b/i,
  ClimateTech: /\b(climatetech|cleantech|greentech|carbon|sustainability|renewables)\b/i,
  PropTech: /\b(proptech|real estate tech|property management)\b/i,
  InsurTech: /\b(insurtech|insurance tech)\b/i,
  HRTech: /\b(hrtech|recruiting platform|workforce)\b/i,
  MarTech: /\b(martech|marketing tech|adtech)\b/i,
  RetailTech: /\b(retailtech|e-commerce|ecommerce|direct to consumer)\b/i,
  LogisticsTech: /\b(logisticstech|supply chain|freight|delivery platform)\b/i,
  DeepTech: /\b(deeptech|hardtech|quantum|semiconductors)\b/i,
  Robotics: /\b(robotics|hardware automation|drones)\b/i,
  DeveloperTools: /\b(developer tools|devtools|api platform|infra|infrastructure)\b/i,
  Automation: /\b(automation|rpa|workflow automation)\b/i,
};

export function parseNaturalLanguageHunt(query: string): ParsedHuntResult {
  const q = query.trim();
  const lower = q.toLowerCase();

  const detectedCountries: string[] = [];
  const detectedRegions: string[] = [];
  const detectedExclusions: string[] = [];
  const detectedSectors: string[] = [];
  const detectedStages: string[] = [];
  const detectedSizes: string[] = [];

  // 1. Detect Exclusions (e.g. "excluding US", "no US", "except India", "exclude America")
  const excludePatterns = [
    /(?:exclude|excluding|except|without|no)\s+([a-zA-Z\s]+?)(?:,|and|\.|$|\bfor\b|\bwith\b)/gi,
  ];

  for (const pat of excludePatterns) {
    let match;
    while ((match = pat.exec(lower)) !== null) {
      const phrase = match[1].trim();
      if (phrase.includes('us') || phrase.includes('usa') || phrase.includes('united states') || phrase.includes('america')) {
        detectedExclusions.push('United States');
      }
      for (const country of COUNTRIES) {
        if (phrase.includes(country.name.toLowerCase())) {
          detectedExclusions.push(country.name);
        }
      }
    }
  }

  // 2. Detect Geography & Countries
  const DEMONYMS: Record<string, string> = {
    indian: 'India',
    chinese: 'China',
    japanese: 'Japan',
    singaporean: 'Singapore',
    korean: 'South Korea',
    australian: 'Australia',
    german: 'Germany',
    french: 'France',
    british: 'United Kingdom',
    swiss: 'Switzerland',
    spanish: 'Spain',
    italian: 'Italy',
    israeli: 'Israel',
    canadian: 'Canada',
    brazilian: 'Brazil',
    emirati: 'United Arab Emirates',
  };

  for (const [dem, cName] of Object.entries(DEMONYMS)) {
    const demPattern = new RegExp(`\\b${dem}\\b`, 'i');
    if (demPattern.test(lower)) {
      if (!detectedExclusions.includes(cName) && !detectedCountries.includes(cName)) {
        detectedCountries.push(cName);
      }
    }
  }

  // Test specific country words
  for (const country of COUNTRIES) {
    const base = country.name.toLowerCase();
    const stem = base.endsWith('a') ? base.slice(0, -1) : base.endsWith('y') ? base.slice(0, -1) : base;
    const wordPattern = new RegExp(`\\b(${base}|${stem}(?:n|an|ian|ese|ish)?)\\b`, 'i');
    if (wordPattern.test(lower)) {
      if (!detectedExclusions.includes(country.name) && !detectedCountries.includes(country.name)) {
        detectedCountries.push(country.name);
      }
    }
  }

  // Regional keywords
  if (/\b(asia|asian)\b/i.test(lower)) detectedRegions.push('Asia');
  if (/\b(europe|european)\b/i.test(lower)) detectedRegions.push('Europe');
  if (/\b(africa|african)\b/i.test(lower)) detectedRegions.push('Africa');
  if (/\b(middle east|middle eastern|gulf|gcc)\b/i.test(lower)) detectedRegions.push('Middle East');
  if (/\b(oceania|australasia)\b/i.test(lower)) detectedRegions.push('Oceania');
  if (/\b(latin america|south america|latam)\b/i.test(lower)) detectedRegions.push('South America');
  if (/\b(southeast asia|sea)\b/i.test(lower)) detectedRegions.push('Southeast Asia');
  if (/\b(south asia)\b/i.test(lower)) detectedRegions.push('South Asia');

  // 3. Detect Sectors
  for (const [sector, pat] of Object.entries(SECTOR_PATTERNS)) {
    if (pat.test(lower)) {
      detectedSectors.push(sector);
    }
  }

  // 4. Detect Funding Ranges (e.g. "$1M-$5M", "$1M to $5M", "1-5 million", "over 10M")
  let fundingMin = 1_000_000;
  let fundingMax = 5_000_000;
  let fundingText = '$1M–$5M';

  const rangeMatch = lower.match(/\$?(\d+(?:\.\d+)?)\s*(?:m|million)?\s*(?:to|-|–)\s*\$?(\d+(?:\.\d+)?)\s*(?:m|million)/i);
  if (rangeMatch) {
    const minVal = parseFloat(rangeMatch[1]);
    const maxVal = parseFloat(rangeMatch[2]);
    if (!isNaN(minVal) && !isNaN(maxVal)) {
      fundingMin = minVal * 1_000_000;
      fundingMax = maxVal * 1_000_000;
      fundingText = `$${minVal}M–$${maxVal}M`;
    }
  } else if (lower.includes('$5m-$10m') || lower.includes('5 to 10 million')) {
    fundingMin = 5_000_000;
    fundingMax = 10_000_000;
    fundingText = '$5M–$10M';
  } else if (lower.includes('$10m-$25m') || lower.includes('10 to 25 million')) {
    fundingMin = 10_000_000;
    fundingMax = 25_000_000;
    fundingText = '$10M–$25M';
  } else if (lower.includes('$0-$1m') || lower.includes('under 1 million')) {
    fundingMin = 0;
    fundingMax = 1_000_000;
    fundingText = '$0–$1M';
  }

  // 5. Detect Company Size (e.g. "20-200 employees", "11-50", "1-10")
  const employeeMatch = lower.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:employees|people|staff|team)/i);
  if (employeeMatch) {
    detectedSizes.push(`${employeeMatch[1]}-${employeeMatch[2]}`);
  } else if (lower.includes('1-10') || lower.includes('early stage team')) {
    detectedSizes.push('1–10');
  } else if (lower.includes('11-50')) {
    detectedSizes.push('11–50');
  } else if (lower.includes('51-200') || lower.includes('20-200') || lower.includes('50-200')) {
    detectedSizes.push('51–200');
  } else if (lower.includes('201-500')) {
    detectedSizes.push('201–500');
  } else if (lower.includes('500+')) {
    detectedSizes.push('500+');
  }

  // 6. Detect Stages
  if (/\bpre-?seed\b/i.test(lower)) detectedStages.push('Pre-seed');
  if (/\bseed\b/i.test(lower)) detectedStages.push('Seed');
  if (/\bseries a\b/i.test(lower)) detectedStages.push('Series A');
  if (/\bseries b\b/i.test(lower)) detectedStages.push('Series B');
  if (/\bseries c\b/i.test(lower)) detectedStages.push('Series C+');
  if (/\bgrowth\b/i.test(lower)) detectedStages.push('Growth');

  // 7. Detect US Presence
  let usPresenceMode: 'strictly_none' | 'minimal_or_none' | 'limited' | 'any' = 'minimal_or_none';
  if (lower.includes('strictly no us') || lower.includes('zero us')) {
    usPresenceMode = 'strictly_none';
  } else if (lower.includes('allow us') || lower.includes('any us') || lower.includes('including us')) {
    usPresenceMode = 'any';
  } else if (lower.includes('limited us')) {
    usPresenceMode = 'limited';
  }

  // Build HuntConfig
  const finalConfig: HuntConfig = {
    ...TVB_EVALUATION_CONFIG,
    id: `nl_hunt_${Date.now()}`,
    name: q.length > 35 ? `${q.slice(0, 32)}...` : q,
    geography: {
      mode: detectedCountries.length > 0 ? 'countries' : detectedRegions.length > 0 ? 'regions' : 'global',
      regions: detectedRegions,
      countries: detectedCountries,
      excludedCountries: detectedExclusions.length > 0 ? detectedExclusions : ['United States'],
      usPresence: usPresenceMode,
    },
    sectors: detectedSectors.length > 0 ? detectedSectors : ['all'],
    businessModels: ['SaaS', 'Platform', 'B2B'],
    stage: detectedStages.length > 0 ? detectedStages : ['Seed', 'Series A'],
    funding: {
      min: fundingMin,
      max: fundingMax,
      mode: 'funding_or_revenue',
      preset: fundingText,
    },
    companySize: detectedSizes,
    techProfile: 'platform_required',
    contactRequirement: 'ceo_or_cofounder',
    emailVerification: 'required',
    depth: 'balanced',
    targetLeads: 15,
    naturalLanguageQuery: q,
  };

  return {
    config: finalConfig,
    detectedSummary: {
      countries: detectedCountries,
      regions: detectedRegions,
      excludedCountries: detectedExclusions,
      sectors: detectedSectors,
      fundingMin,
      fundingMax,
      fundingText,
      stages: detectedStages,
      companySize: detectedSizes,
      usPresence: usPresenceMode,
      contact: 'CEO or Co-founder',
    },
    confidence: detectedCountries.length > 0 || detectedSectors.length > 0 ? 0.9 : 0.6,
    rawQuery: q,
  };
}
