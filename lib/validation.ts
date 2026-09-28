/**
 * Validation Module
 * 
 * Deterministic validation functions for company qualification:
 * - Dynamic, multi-currency funding range checking ($min–$max USD, INR, EUR, GBP, etc.)
 * - Multi-industry & sector validation (supports Agriculture, Healthcare, Automotive, CleanTech, SaaS, etc.)
 * - Deterministic geography & country verification against HuntConfig
 * - Deterministic US presence evaluation (strictly_none, minimal_or_none, some_allowed, any, exclude_us, unknown)
 * - Deterministic founder/CEO role qualification
 * - Detailed audit result generation for qualified and rejected candidates
 */

import { ExtractedCompanyData, ValidatedCompany, HuntConfig, TVB_EVALUATION_CONFIG, RejectedCompanyRecord } from './types';
import { detectCountryFromEvidence, findCountry } from './geography';
import { ALL_PREDEFINED_INDUSTRIES, SUB_INDUSTRY_MAP, INDUSTRY_TAXONOMY } from './targetProfileData';

export const MIN_FUNDING_USD = 1_000_000;
export const MAX_FUNDING_USD = 5_000_000;

/**
 * Tech platform keywords for validation
 */
export const TECH_PLATFORM_KEYWORDS = [
  'software',
  'saas',
  'platform',
  'marketplace',
  'api',
  'app',
  'application',
  'fintech',
  'healthtech',
  'edtech',
  'proptech',
  'insurtech',
  'regtech',
  'martech',
  'hrtech',
  'legaltech',
  'agritech',
  'foodtech',
  'cleantech',
  'greentech',
  'biotech',
  'medtech',
  'ai',
  'artificial intelligence',
  'machine learning',
  'ml',
  'data',
  'analytics',
  'cloud',
  'devops',
  'cybersecurity',
  'security',
  'blockchain',
  'crypto',
  'web3',
  'iot',
  'robotics',
  'automation',
  'b2b',
  'enterprise software',
  'developer tools',
  'infrastructure',
];

const AI_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'machine learning',
  'ml',
  'genai',
  'llm',
  'deep learning',
  'neural',
  'nlp',
  'computer vision',
  'data product',
];

/**
 * Parses funding or revenue text into numeric value with detected currency.
 * Supports:
 * - USD ($), EUR (€), GBP (£), AUD (A$), CAD (C$), SGD (S$)
 * - INR (₹, Rs, INR, Lakh, Crore, Cr)
 * - Plain number representations
 */
export function parseFundingDetails(text: string | null): {
  amountRaw: number;
  currency: 'USD' | 'INR' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD';
  amountUsd: number;
  amountInr: number;
} | null {
  if (!text || typeof text !== 'string') return null;

  const clean = text.toLowerCase().replace(/,/g, '');

  // Detect currency
  let detectedCurrency: 'USD' | 'INR' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' = 'USD';
  let toUsdRate = 1.0;

  if (clean.includes('₹') || clean.includes('inr') || clean.includes('rs') || clean.includes('lakh') || clean.includes('crore') || clean.includes(' cr')) {
    detectedCurrency = 'INR';
    toUsdRate = 1 / 85; // Approx 85 INR per USD
  } else if (clean.includes('€') || clean.includes('eur') || clean.includes('euro')) {
    detectedCurrency = 'EUR';
    toUsdRate = 1.08;
  } else if (clean.includes('£') || clean.includes('gbp') || clean.includes('pound')) {
    detectedCurrency = 'GBP';
    toUsdRate = 1.28;
  } else if (clean.includes('a$') || clean.includes('aud')) {
    detectedCurrency = 'AUD';
    toUsdRate = 0.67;
  } else if (clean.includes('c$') || clean.includes('cad')) {
    detectedCurrency = 'CAD';
    toUsdRate = 0.74;
  } else if (clean.includes('s$') || clean.includes('sgd')) {
    detectedCurrency = 'SGD';
    toUsdRate = 0.76;
  }

  // Check Indian Crore pattern (e.g. ₹5 Crore, 10 Cr, 50 crores)
  const croreMatch = clean.match(/([\d\.]+)\s*(crores?|cr\b)/i);
  if (croreMatch) {
    const val = parseFloat(croreMatch[1]);
    if (!isNaN(val)) {
      const inrAmount = val * 10_000_000;
      return {
        amountRaw: inrAmount,
        currency: 'INR',
        amountUsd: inrAmount * toUsdRate,
        amountInr: inrAmount,
      };
    }
  }

  // Check Indian Lakh pattern (e.g. ₹50 Lakh, 25 lakhs, 10 lac)
  const lakhMatch = clean.match(/([\d\.]+)\s*(lakhs?|lacs?|lac\b)/i);
  if (lakhMatch) {
    const val = parseFloat(lakhMatch[1]);
    if (!isNaN(val)) {
      const inrAmount = val * 100_000;
      return {
        amountRaw: inrAmount,
        currency: 'INR',
        amountUsd: inrAmount * toUsdRate,
        amountInr: inrAmount,
      };
    }
  }

  // Check Billion pattern (e.g. $1B, 1 billion)
  const billionMatch = clean.match(/([\d\.]+)\s*(billion|b\b)/i);
  if (billionMatch) {
    const val = parseFloat(billionMatch[1]);
    if (!isNaN(val)) {
      const raw = val * 1_000_000_000;
      return {
        amountRaw: raw,
        currency: detectedCurrency,
        amountUsd: raw * toUsdRate,
        amountInr: raw * toUsdRate * 85,
      };
    }
  }

  // Check Million pattern (e.g. $2.5M, 4 million, €3M)
  const millionMatch = clean.match(/([\d\.]+)\s*(million|m\b)/i);
  if (millionMatch) {
    const val = parseFloat(millionMatch[1]);
    if (!isNaN(val)) {
      const raw = val * 1_000_000;
      return {
        amountRaw: raw,
        currency: detectedCurrency,
        amountUsd: raw * toUsdRate,
        amountInr: raw * toUsdRate * 85,
      };
    }
  }

  // Check Thousand pattern (e.g. $500K, 250k)
  const thousandMatch = clean.match(/([\d\.]+)\s*(thousand|k\b)/i);
  if (thousandMatch) {
    const val = parseFloat(thousandMatch[1]);
    if (!isNaN(val)) {
      const raw = val * 1_000;
      return {
        amountRaw: raw,
        currency: detectedCurrency,
        amountUsd: raw * toUsdRate,
        amountInr: raw * toUsdRate * 85,
      };
    }
  }

  // Raw number fallback
  const rawNumberMatch = clean.match(/[\d\.]{4,}/);
  if (rawNumberMatch) {
    const val = parseFloat(rawNumberMatch[0]);
    if (!isNaN(val)) {
      return {
        amountRaw: val,
        currency: detectedCurrency,
        amountUsd: val * toUsdRate,
        amountInr: val * toUsdRate * 85,
      };
    }
  }

  return null;
}

/**
 * Backward compatible funding parser, returns USD equivalent numeric
 */
export function parseFundingAmount(text: string | null): number | null {
  const details = parseFundingDetails(text);
  return details ? details.amountUsd : null;
}

/**
 * Check funding range against dynamic min/max with multi-currency calibration
 */
export function checkFundingRange(
  fundingInput: string | null | { fundingOrRevenueText?: string | null; totalFundingUsd?: number | null },
  min: number | string = MIN_FUNDING_USD,
  max: number | string = MAX_FUNDING_USD,
  targetCurrency: string = 'USD'
): { passed: boolean; inRange: boolean; parsedUsd?: number; parsedText?: string; reason?: string } {
  let fundingText: string | null = null;
  if (typeof fundingInput === 'string') {
    fundingText = fundingInput;
  } else if (fundingInput && typeof fundingInput === 'object') {
    fundingText = fundingInput.fundingOrRevenueText || (fundingInput.totalFundingUsd ? `$${fundingInput.totalFundingUsd}` : null);
  }

  const details = parseFundingDetails(fundingText);
  if (!details) {
    return { passed: false, inRange: false, reason: 'Funding/revenue figure could not be verified' };
  }

  const cur = targetCurrency.toUpperCase();

  // Normalize min/max if strings were passed (e.g. '₹50 Lakh' or '$1M')
  let minNum: number = typeof min === 'number' ? min : 0;
  let maxNum: number = typeof max === 'number' ? max : 1_000_000_000;
  if (typeof min === 'string') {
    const minParsed = parseFundingDetails(min);
    if (minParsed) {
      minNum = cur === 'INR' ? minParsed.amountInr : minParsed.amountUsd;
    }
  }
  if (typeof max === 'string') {
    const maxParsed = parseFundingDetails(max);
    if (maxParsed) {
      maxNum = cur === 'INR' ? maxParsed.amountInr : maxParsed.amountUsd;
    }
  }

  let candidateVal: number;
  let minVal = minNum;
  let maxVal = maxNum;

  if (cur === 'INR') {
    candidateVal = details.amountInr;
  } else {
    // USD or other global currency, compare normalized USD
    candidateVal = details.amountUsd;
    if (minNum > 10_000_000 && cur === 'USD') {
      // Safety if INR min was passed without converting
      minVal = minNum / 85;
      maxVal = maxNum / 85;
    }
  }

  // 10% grace buffer for currency fluctuation and seed ranges
  const lowerBound = minVal * 0.9;
  const upperBound = maxVal * 1.1;

  if (candidateVal >= lowerBound && candidateVal <= upperBound) {
    return { passed: true, inRange: true, parsedUsd: details.amountUsd, parsedText: fundingText || undefined };
  }

  return {
    passed: false,
    inRange: false,
    parsedUsd: details.amountUsd,
    parsedText: fundingText || undefined,
    reason: `Funding out of range (${candidateVal < lowerBound ? 'below minimum' : 'exceeds maximum'})`,
  };
}

/**
 * Check industry & sector fit.
 * Supports:
 * - Direct ExtractedCompany object or description/industry strings
 * - Tech Platform (software, SaaS, AI, etc.)
 * - Non-tech sectors (Agriculture, Dairy, Pharmaceuticals, Automotive, Manufacturing, CleanTech, etc.)
 * - Sub-industry matching
 */
export function checkIndustryFit(
  companyOrDescription: any,
  industryOrProfileOrSectors?: any,
  profileOrSectors?: any,
  sectorsOrSubIndustries?: any,
  subIndustriesParam?: any
): { passed: boolean; fit: boolean; matchedTerm?: string; reason?: string } {
  let description = '';
  let industry = '';
  let subIndustry = '';
  let profile: HuntConfig['techProfile'] = 'platform_required';
  let sectors: string[] = ['all'];
  let subIndustries: string[] = [];

  // Determine if first argument is a company object
  if (companyOrDescription && typeof companyOrDescription === 'object') {
    description = companyOrDescription.description || '';
    industry = companyOrDescription.industry || '';
    subIndustry = companyOrDescription.subIndustry || '';

    if (Array.isArray(industryOrProfileOrSectors)) {
      sectors = industryOrProfileOrSectors;
      subIndustries = Array.isArray(profileOrSectors) ? profileOrSectors : [];
    } else if (typeof industryOrProfileOrSectors === 'string') {
      profile = industryOrProfileOrSectors as any;
      sectors = Array.isArray(profileOrSectors) ? profileOrSectors : ['all'];
      subIndustries = Array.isArray(sectorsOrSubIndustries) ? sectorsOrSubIndustries : [];
    }
  } else {
    description = companyOrDescription || '';
    industry = typeof industryOrProfileOrSectors === 'string' ? industryOrProfileOrSectors : '';
    profile = (typeof profileOrSectors === 'string' ? profileOrSectors : 'platform_required') as any;
    sectors = Array.isArray(profileOrSectors) ? profileOrSectors : Array.isArray(sectorsOrSubIndustries) ? sectorsOrSubIndustries : ['all'];
    subIndustries = Array.isArray(subIndustriesParam) ? subIndustriesParam : [];
  }

  const text = `${description} ${industry} ${subIndustry}`.toLowerCase();
  if (!text.trim()) {
    return { passed: false, fit: false, reason: 'No industry or business description available' };
  }

  const activeSectors = (sectors || []).filter(s => s !== 'all' && s !== 'All sectors' && s !== 'Any');

  // If specific sectors were chosen:
  if (activeSectors.length > 0) {
    // 1. Direct match on selected sectors and their component words
    for (const sec of activeSectors) {
      const cleanSec = sec.toLowerCase();
      if (text.includes(cleanSec)) {
        return { passed: true, fit: true, matchedTerm: sec };
      }
      // Check individual words/tokens (e.g. "Agriculture" from "Agriculture & Food")
      const words = cleanSec.split(/[\s&/,\-]+/).filter(w => w.length > 3);
      for (const word of words) {
        if (text.includes(word)) {
          return { passed: true, fit: true, matchedTerm: `${sec} (${word})` };
        }
      }
    }

    // 2. Direct match on sub-industries
    for (const sub of subIndustries || []) {
      const cleanSub = sub.toLowerCase();
      if (text.includes(cleanSub)) {
        return { passed: true, fit: true, matchedTerm: sub };
      }
    }

    // 3. Match against taxonomy sub-industry map for selected sectors
    for (const sec of activeSectors) {
      // Lookup direct or clean keys
      const mappedSubs = SUB_INDUSTRY_MAP[sec] || SUB_INDUSTRY_MAP[sec.split(/[\s&/]/)[0]] || [];
      for (const mSub of mappedSubs) {
        if (text.includes(mSub.toLowerCase())) {
          return { passed: true, fit: true, matchedTerm: `${sec} (${mSub})` };
        }
      }

      // Check category in INDUSTRY_TAXONOMY
      const taxCat = INDUSTRY_TAXONOMY.find(c => c.category.toLowerCase().includes(sec.toLowerCase()) || sec.toLowerCase().includes(c.category.toLowerCase()));
      if (taxCat) {
        for (const ind of taxCat.industries) {
          if (text.includes(ind.toLowerCase())) {
            return { passed: true, fit: true, matchedTerm: `${sec} (${ind})` };
          }
        }
      }
    }

    return {
      passed: false,
      fit: false,
      reason: `Does not match targeted industries: ${activeSectors.slice(0, 3).join(', ')}`,
    };
  }

  // If all sectors / general mode:
  if (profile === 'ai_first') {
    const isAi = AI_KEYWORDS.some(kw => text.includes(kw));
    return isAi ? { passed: true, fit: true, matchedTerm: 'AI' } : { passed: false, fit: false, reason: 'AI-first architecture not detected' };
  }

  if (profile === 'software_only') {
    const isSoftware = text.includes('software') || text.includes('saas') || text.includes('app');
    return isSoftware ? { passed: true, fit: true, matchedTerm: 'Software' } : { passed: false, fit: false, reason: 'Software or SaaS product not detected' };
  }

  if (profile === 'any_tech') {
    return { passed: true, fit: true, matchedTerm: 'General Technology' };
  }

  // Default: check if candidate has tech platform or software DNA
  const matchesTech = TECH_PLATFORM_KEYWORDS.some(kw => text.includes(kw));
  return matchesTech
    ? { passed: true, fit: true, matchedTerm: 'Tech Platform' }
    : { passed: false, fit: false, reason: 'Does not demonstrate software, platform, or proprietary technology DNA' };
}

/**
 * Backward compatible wrapper for checkTechPlatform
 */
export function checkTechPlatform(
  description: string | null,
  industry: string | null,
  profile: HuntConfig['techProfile'] = 'platform_required',
  sectors: string[] = ['all']
): boolean {
  return checkIndustryFit(description, industry, profile, sectors).passed;
}

/**
 * Deterministic US Presence Check:
 * - true  => US presence detected (fails for strict non-US)
 * - false => Confirmed Non-US (passes)
 * - null  => Undetermined
 */
export function checkNoUSPresence(
  evidenceText: string | null,
  websiteUrl: string,
  mode: HuntConfig['geography']['usPresence'] | 'exclude_us' | 'some_allowed' | 'dont_care' | 'unknown' = 'minimal_or_none'
): boolean | null {
  const text = (evidenceText || '').toLowerCase();

  // If user allows any US presence or doesn't care
  if (mode === 'any' || mode === 'dont_care') {
    return false; // passes
  }

  // Strong US signals
  const usStateNames = /\b(california|texas|new york|florida|illinois|massachusetts|washington state|delaware|nevada|san francisco|silicon valley|austin|seattle|boston|los angeles|chicago)\b/i;
  const usPhonePattern = /\+1[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/;
  const usAddressWords = /\b(headquartered in the us|based in the us|united states|usa office|u\.s\.[\s-]based|us headquarters)\b/i;

  const hasStrongUsSignal = usStateNames.test(text) || usPhonePattern.test(text) || usAddressWords.test(text);

  if (hasStrongUsSignal) {
    if (mode === 'strictly_none' || mode === 'minimal_or_none' || mode === 'exclude_us') {
      return true; // Detected US -> Fails
    }
  }

  // Strong non-US signals: Countries & Global Hubs
  const detected = detectCountryFromEvidence(evidenceText, websiteUrl);
  if (detected && detected.code !== 'US') {
    return false; // Confirmed Non-US -> Passes
  }

  // For unknown: unverified evidence must NOT automatically count as compliant!
  if (mode === 'unknown') {
    return true; // Fails due to lack of conclusive non-US proof
  }

  return null; // Undetermined
}

/**
 * Geography Validation against HuntConfig
 */
export function checkGeographyMatch(
  evidenceText: string | null,
  websiteUrl: string,
  config: HuntConfig
): { passed: boolean; detectedCountry?: string; detectedRegion?: string; reason?: string } {
  const detected = detectCountryFromEvidence(evidenceText, websiteUrl);
  const detectedName = detected ? detected.name : null;
  const detectedRegion = detected ? detected.region : null;

  const targetCountries = (config.geography.countries || []).map(c => c.toLowerCase());
  const targetRegions = (config.geography.regions || []).map(r => r.toLowerCase());
  const excluded = (config.geography.excludedCountries || []).map(e => e.toLowerCase());

  // Check Exclusions
  if (detectedName && excluded.includes(detectedName.toLowerCase())) {
    return { passed: false, detectedCountry: detectedName, reason: `Excluded country: ${detectedName}` };
  }

  // If United States excluded and detected is US
  const usVerdict = checkNoUSPresence(evidenceText, websiteUrl, config.geography.usPresence as any);
  if (excluded.includes('united states') && (detectedName === 'United States' || usVerdict === true)) {
    return { passed: false, detectedCountry: 'United States', reason: 'US presence detected while US is excluded' };
  }

  // Specific countries targeted
  if (targetCountries.length > 0) {
    if (!detectedName || !targetCountries.includes(detectedName.toLowerCase())) {
      return {
        passed: false,
        detectedCountry: detectedName || undefined,
        reason: `Country does not match target: ${config.geography.countries.join(', ')}`,
      };
    }
  }
  // Specific regions targeted
  else if (targetRegions.length > 0) {
    if (!detectedRegion || !targetRegions.includes(detectedRegion.toLowerCase())) {
      return {
        passed: false,
        detectedRegion: detectedRegion || undefined,
        reason: `Region does not match target: ${config.geography.regions.join(', ')}`,
      };
    }
  }

  // Validate US presence policy
  if (config.geography.usPresence === 'strictly_none' && usVerdict !== false) {
    return { passed: false, reason: 'Strictly zero US presence required (unverified or US detected)' };
  }
  if (config.geography.usPresence === 'minimal_or_none' && usVerdict === true) {
    return { passed: false, reason: 'Significant US headquarters detected' };
  }

  return {
    passed: true,
    detectedCountry: detectedName || 'Global',
    detectedRegion: detectedRegion || 'Global',
  };
}

export interface CandidateValidationAudit {
  qualified: boolean;
  validatedCompany: ValidatedCompany | null;
  rejectedRecord: RejectedCompanyRecord | null;
  matchedRules: string[];
  failedRules: string[];
  rejectionReasons: string[];
}

/**
 * Deterministically audit a candidate against the active target profile.
 * Records all matched and failed criteria for transparent inspection (Section 23).
 */
export function auditCompany(
  data: ExtractedCompanyData,
  websiteUrl: string,
  sourceType: string = 'Discovery',
  config: HuntConfig = TVB_EVALUATION_CONFIG
): CandidateValidationAudit {
  const matchedRules: string[] = [];
  const failedRules: string[] = [];
  const rejectionReasons: string[] = [];

  const targetCur = config.targetProfile?.fundingCurrency || 'USD';
  const targetMin = config.targetProfile?.fundingMin || config.funding.min;
  const targetMax = config.targetProfile?.fundingMax || config.funding.max;

  // 1. Funding range check
  const fundingVerdict = checkFundingRange(data.fundingOrRevenueText, targetMin, targetMax, targetCur);
  if (fundingVerdict.passed) {
    matchedRules.push(`✓ Funding range (${data.fundingOrRevenueText || 'Verified'})`);
  } else {
    failedRules.push(`✗ Funding requirement (${fundingVerdict.reason || 'Out of range'})`);
    rejectionReasons.push('OUT_OF_RANGE');
  }

  // 2. Industry fit check
  const activeSectors = config.targetProfile?.industries || config.sectors || ['all'];
  const activeSubs = config.targetProfile?.subIndustries || config.businessModels || [];
  const industryVerdict = checkIndustryFit(data.description, data.industry, config.techProfile, activeSectors, activeSubs);

  if (industryVerdict.passed) {
    matchedRules.push(`✓ Industry: ${industryVerdict.matchedTerm || data.industry || 'Matched'}`);
  } else {
    failedRules.push(`✗ Industry mismatch: ${industryVerdict.reason || 'Unmatched'}`);
    rejectionReasons.push('INDUSTRY_MISMATCH');
  }

  // 3. Geography & US presence check
  const geoVerdict = checkGeographyMatch(
    `${data.usPresenceEvidence || ''} ${data.headquarters || ''} ${data.country || ''}`,
    websiteUrl,
    config
  );
  if (geoVerdict.passed) {
    matchedRules.push(`✓ Location: ${geoVerdict.detectedCountry || data.country || 'Non-US Hub'}`);
  } else {
    failedRules.push(`✗ Geography requirement: ${geoVerdict.reason || 'Non-compliant location'}`);
    if (geoVerdict.reason?.includes('US presence')) {
      rejectionReasons.push('US_PRESENCE_DETECTED');
    } else {
      rejectionReasons.push('LOCATION_MISMATCH');
    }
  }

  // 4. Decision Maker / Founder check
  const hasFounder = !!(data.founderOrCeoName && data.founderOrCeoName.trim().length >= 2);
  if (hasFounder) {
    matchedRules.push(`✓ Executive verified: ${data.founderOrCeoName}`);
  } else {
    failedRules.push('✗ CEO or Co-founder not verified');
    rejectionReasons.push('CEO_NOT_FOUND');
  }

  // 5. Company Name check
  const hasName = !!(data.name && data.name.trim().length >= 2);
  if (hasName) {
    matchedRules.push(`✓ Entity identified: ${data.name}`);
  } else {
    failedRules.push('✗ Company name unavailable');
    rejectionReasons.push('NAME_MISSING');
  }

  const qualified = fundingVerdict.passed && industryVerdict.passed && geoVerdict.passed && hasFounder && hasName;

  const nowIso = new Date().toISOString();

  if (qualified) {
    return {
      qualified: true,
      validatedCompany: {
        name: data.name!.trim(),
        website: websiteUrl,
        description: data.description,
        industry: industryVerdict.matchedTerm || data.industry || 'Venture Platform',
        fundingOrRevenueText: data.fundingOrRevenueText,
        usPresenceEvidence: data.usPresenceEvidence,
        founderOrCeoName: data.founderOrCeoName!.trim(),
        sourceType,
        country: geoVerdict.detectedCountry || data.country || 'Non-US',
        headquarters: data.headquarters || geoVerdict.detectedCountry || 'International',
      },
      rejectedRecord: null,
      matchedRules,
      failedRules,
      rejectionReasons: [],
    };
  }

  return {
    qualified: false,
    validatedCompany: null,
    rejectedRecord: {
      name: data.name || (new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname),
      website: websiteUrl,
      industry: data.industry || 'Unknown',
      fundingOrRevenue: data.fundingOrRevenueText || 'Unverified',
      location: geoVerdict.detectedCountry || data.country || 'Undetermined',
      founderOrCeoName: data.founderOrCeoName || undefined,
      rejectionReasons,
      matchedRules,
      failedRules,
      sourceEvidence: `${data.description || ''} ${data.usPresenceEvidence || ''}`.trim(),
      firstDiscoveredAt: nowIso,
      lastSeenAt: nowIso,
      lastVerifiedAt: nowIso,
      lastUpdatedAt: nowIso,
    },
    matchedRules,
    failedRules,
    rejectionReasons,
  };
}

/**
 * Validate all criteria for a candidate according to active HuntConfig
 */
export function validateCompany(
  data: ExtractedCompanyData,
  websiteUrl: string,
  sourceType: string = 'Discovery',
  config: HuntConfig = TVB_EVALUATION_CONFIG
): ValidatedCompany | null {
  const audit = auditCompany(data, websiteUrl, sourceType, config);
  return audit.validatedCompany;
}