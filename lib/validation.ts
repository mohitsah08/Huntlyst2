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

  // Strict deterministic boundaries (no hidden grace buffer)
  const lowerBound = minVal;
  const upperBound = maxVal;

  if (candidateVal >= lowerBound && candidateVal <= upperBound) {
    return { passed: true, inRange: true, parsedUsd: details.amountUsd, parsedText: fundingText || undefined };
  }

  return {
    passed: false,
    inRange: false,
    parsedUsd: details.amountUsd,
    parsedText: fundingText || undefined,
    reason: `Funding out of range: $${Math.round(candidateVal).toLocaleString()} USD is ${candidateVal < lowerBound ? 'below minimum $' + minVal.toLocaleString() : 'above maximum $' + maxVal.toLocaleString()}`,
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
 * Deterministic US Presence Check
 * @deprecated Obsolete legacy venture requirement. The dedicated US Presence concept has been
 * purged in favor of clean Geography (Global vs Continents/Countries Union).
 * Always returns false (no restriction violation) for backwards compatibility.
 */
export function checkNoUSPresence(
  evidenceText: string | null,
  websiteUrl: string,
  mode: any = 'any'
): boolean | null {
  return false;
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

  const mode = config.geography.mode || 'global';
  const targetContinents = [
    ...(config.geography.continents || []),
    ...(config.geography.regions || [])
  ]
    .map(r => r.toLowerCase())
    .filter(r => r !== 'global' && r !== 'all');

  const targetCountries = (config.geography.countries || []).map(c => c.toLowerCase());
  const excluded = (config.geography.excludedCountries || []).map(e => e.toLowerCase());

  // 1. Check explicit exclusions
  if (detectedName && excluded.includes(detectedName.toLowerCase())) {
    return { passed: false, detectedCountry: detectedName, reason: `Excluded country: ${detectedName}` };
  }

  // 2. Global Coverage Semantics (Section 14)
  const isGlobal = mode === 'global' || 
    (config.geography.regions || []).some(r => r.toLowerCase() === 'global') ||
    (targetContinents.length === 0 && targetCountries.length === 0);

  if (isGlobal) {
    // In Global mode, all countries are eligible. No hidden US restriction.
    return {
      passed: true,
      detectedCountry: detectedName || 'Global',
      detectedRegion: detectedRegion || 'Global',
      reason: 'Global coverage — all countries eligible',
    };
  }

  // 3. Continent + Country Union Semantics (Section 15)
  // Selected geography is the UNION of selected continents and selected countries.
  const matchesCountry = detectedName && targetCountries.includes(detectedName.toLowerCase());
  const matchesContinent = detectedRegion && targetContinents.includes(detectedRegion.toLowerCase());

  if (targetCountries.length > 0 || targetContinents.length > 0) {
    if (!matchesCountry && !matchesContinent) {
      const targetLabels = [...(config.geography.continents || config.geography.regions || []), ...(config.geography.countries || [])].filter(Boolean);
      return {
        passed: false,
        detectedCountry: detectedName || undefined,
        detectedRegion: detectedRegion || undefined,
        reason: `Location (${detectedName || detectedRegion || 'Unknown'}) does not match target geography: ${targetLabels.join(', ')}`,
      };
    }
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

export interface CanonicalCandidateInput {
  name: string;
  website: string;
  canonicalDomain?: string;
  description?: string | null;
  industry?: string | null;
  rawIndustry?: string | null;
  subIndustry?: string | null;
  fundingAmount?: number | string | null;
  verifiedFundingAmount?: number | string | null;
  fundingStatus?: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'CONFLICT' | 'UNVERIFIED' | 'UNKNOWN' | null;
  fundingDate?: string | null;
  fundingType?: string | null;
  totalFundingUsd?: number | null;
  latestRoundUsd?: number | null;
  revenueAmount?: number | null;
  fundingOrRevenueText?: string | null;
  country?: string | null;
  location?: string | null;
  city?: string | null;
  headquarters?: string | null;
  founderOrCeoName?: string | null;
  ceoName?: string | null;
  founderOrCeoRole?: string | null;
  founderOrCeoEmail?: string | null;
  contactEmail?: string | null;
  email?: string | null;
  emailStatus?: string | null;
  emailVerified?: boolean | null;
  hasActiveMx?: boolean | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  sourceType?: string;
  sourceEvidence?: string | null;
  isMismatch?: boolean;
  conflictDetails?: string | null;
}

export interface CanonicalCriterionEvaluation {
  name: string;
  category: 'identity' | 'geography' | 'funding' | 'industry' | 'executive' | 'contact' | 'stage';
  active: boolean;
  status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'CONTRADICTED' | 'INFORMATIONAL';
  requiredValue: string;
  actualValue: string;
  reason?: string;
  evidence?: string | null;
  weight: number;
}

export interface CanonicalQualificationResult {
  qualified: boolean;
  status: 'QUALIFIED' | 'UNDER_REVIEW' | 'REVIEW' | 'REJECTED';
  verdict: 'Qualified' | 'Under Review' | 'Rejected';
  matchScore: number;
  matchPercentage: string;
  exactReason: string;
  rejectionReason?: string;
  reviewReason?: string;
  reasons: string[];
  passedCriteria: string[];
  failedCriteria: string[];
  unknownCriteria: string[];
  criteria: Record<string, CanonicalCriterionEvaluation>;
  criteriaChecks: CanonicalCriterionEvaluation[];
  checkedAt: string;
}

/**
 * Canonical Target Evaluation & Qualification Engine
 * Single source of truth across Internal Input, External Discovery, and Scheduled Automation.
 */
export function evaluateCanonicalTargetQualification(
  candidate: CanonicalCandidateInput,
  targetInput: any
): CanonicalQualificationResult {
  const checkedAt = new Date().toISOString();
  const target = targetInput || {};
  const isHunt = 'geography' in target && 'funding' in target && !('fundingMin' in target);

  // 1. Funding parameters
  const fMin: number = isHunt ? target.funding.min : (target.fundingMin ?? 100_000);
  const fMax: number = isHunt ? target.funding.max : (target.fundingMax ?? 10_000_000);
  const fCur: string = isHunt ? 'USD' : (target.fundingCurrency ?? 'USD');
  const fMetricRaw = isHunt ? target.funding.mode : (target.financialMetric ?? 'funding_only');
  const fMetric = String(fMetricRaw).toUpperCase();

  // 2. Geography parameters
  const continents: string[] = isHunt
    ? (target.geography.continents || target.geography.regions || []).filter((r: string) => r.toLowerCase() !== 'global')
    : (target.continents || target.regions || []).filter((r: string) => r.toLowerCase() !== 'global');
  const countries: string[] = isHunt ? (target.geography.countries || []) : (target.countries || []);
  const excludedCountries: string[] = isHunt ? (target.geography.excludedCountries || []) : (target.excludedCountries || []);

  const hasSpecificGeography = continents.length > 0 || countries.length > 0;
  const isGlobal = isHunt
    ? (target.geography.mode === 'global' && !hasSpecificGeography)
    : (!hasSpecificGeography);

  // 3. Industry parameters
  const rawIndustries: string[] = isHunt ? (target.sectors || []) : (target.industries || []);
  const isAllIndustries = !rawIndustries.length ||
    rawIndustries.some((i: string) => i.toLowerCase() === 'all' || i.toLowerCase() === 'all industries');
  const industries = isAllIndustries ? [] : rawIndustries;
  const subIndustries: string[] = isHunt ? (target.businessModels || []) : (target.subIndustries || []);

  const criteria: Record<string, CanonicalCriterionEvaluation> = {};

  // Criterion 1: Identity & Website
  const hasValidName = !!(candidate.name && candidate.name.trim().length >= 2);
  const hasValidWebsite = !!(candidate.website && candidate.website.trim().length >= 3 && (candidate.website.includes('.') || candidate.website.startsWith('http')));
  
  if (candidate.isMismatch) {
    criteria.identity = {
      name: 'Company Identity',
      category: 'identity',
      active: true,
      status: 'CONTRADICTED',
      requiredValue: 'Verifiable authentic company identity',
      actualValue: candidate.name || 'Unknown',
      reason: candidate.conflictDetails || 'Conflicting company identity between source and authoritative registry',
      evidence: candidate.sourceEvidence,
      weight: 20,
    };
  } else if (hasValidName && hasValidWebsite) {
    criteria.identity = {
      name: 'Company Identity',
      category: 'identity',
      active: true,
      status: 'PASS',
      requiredValue: 'Authentic name and active website',
      actualValue: `${candidate.name} (${candidate.website})`,
      reason: `Company identity verified: ${candidate.name}`,
      evidence: candidate.website,
      weight: 20,
    };
  } else {
    criteria.identity = {
      name: 'Company Identity',
      category: 'identity',
      active: true,
      status: 'FAIL',
      requiredValue: 'Authentic name and active website',
      actualValue: candidate.name || 'Missing name',
      reason: !hasValidName ? 'Company name missing or too short' : 'Website URL invalid or unresolvable',
      weight: 20,
    };
  }

  // Criterion 2: Geography (Section 4, 5, 6, 25, 26)
  const candidateCountry = candidate.country || '';
  if (isGlobal) {
    // In Global mode: ALL COUNTRIES ARE ELIGIBLE. Country is INFORMATIONAL.
    // Does NOT reduce score. Does NOT cause rejection. Does NOT have active weight.
    criteria.geography = {
      name: 'Geography',
      category: 'geography',
      active: false,
      status: 'PASS',
      requiredValue: 'Global — all countries allowed',
      actualValue: candidateCountry || candidate.city || 'Global',
      reason: 'Global coverage — all countries allowed (no geographic restrictions)',
      evidence: candidate.headquarters || candidateCountry,
      weight: 0,
    };
  } else {
    // Specific geography (Continents/Countries Union)
    const targetLabels = [...continents, ...countries];
    const isExcluded = candidateCountry && excludedCountries.some(e =>
      candidateCountry.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(candidateCountry.toLowerCase())
    );

    if (isExcluded) {
      criteria.geography = {
        name: 'Geography',
        category: 'geography',
        active: true,
        status: 'FAIL',
        requiredValue: `Allowed: ${targetLabels.join(', ')} (Excluded: ${excludedCountries.join(', ')})`,
        actualValue: candidateCountry,
        reason: `Headquarters in excluded country (${candidateCountry})`,
        evidence: candidate.headquarters || candidateCountry,
        weight: 25,
      };
    } else {
      const mockHuntConfig: HuntConfig = isHunt ? target : {
        geography: {
          mode: continents.length > 0 && countries.length > 0 ? 'union' : continents.length > 0 ? 'continents' : 'countries',
          regions: continents,
          continents,
          countries,
          excludedCountries,
        },
        sectors: [],
        businessModels: [],
        stage: [],
        funding: { min: fMin, max: fMax, mode: 'funding' },
      };

      const geoResult = checkGeographyMatch(
        `Location: ${candidate.city || ''} ${candidateCountry} ${candidate.headquarters || ''} ${candidate.sourceEvidence || ''}`,
        candidate.website,
        mockHuntConfig
      );

      if (geoResult.passed) {
        criteria.geography = {
          name: 'Geography',
          category: 'geography',
          active: true,
          status: 'PASS',
          requiredValue: targetLabels.join(', '),
          actualValue: geoResult.detectedCountry || candidateCountry,
          reason: `Matches target geography (${geoResult.detectedCountry || candidateCountry})`,
          evidence: geoResult.detectedRegion || candidate.headquarters,
          weight: 25,
        };
      } else {
        criteria.geography = {
          name: 'Geography',
          category: 'geography',
          active: true,
          status: 'FAIL',
          requiredValue: targetLabels.join(', '),
          actualValue: candidateCountry || 'Unknown',
          reason: geoResult.reason || `Location (${candidateCountry || 'Unknown'}) does not match target geography: ${targetLabels.join(', ')}`,
          evidence: candidate.headquarters,
          weight: 25,
        };
      }
    }
  }

  // Criterion 3: Funding / Revenue (Sections 8, 9, 10)
  const formatUsd = (n: number) => `$${Math.round(n).toLocaleString()} USD`;

  if (candidate.fundingStatus === 'CONFLICT') {
    criteria.funding = {
      name: 'Funding',
      category: 'funding',
      active: true,
      status: 'CONTRADICTED',
      requiredValue: `${formatUsd(fMin)} – ${formatUsd(fMax)}`,
      actualValue: `Input: ${candidate.fundingAmount || 'N/A'} vs Verified: ${candidate.verifiedFundingAmount || 'N/A'}`,
      reason: 'Funding Conflict: Source input differs significantly from current web evidence (Under Review)',
      evidence: candidate.sourceEvidence,
      weight: 25,
    };
  } else {
    let amountUsd: number | null = null;
    if (typeof candidate.fundingAmount === 'number') amountUsd = candidate.fundingAmount;
    else if (typeof candidate.fundingAmount === 'string') {
      const p = parseFundingDetails(candidate.fundingAmount);
      if (p) amountUsd = p.amountUsd;
    }
    if (amountUsd === null && typeof candidate.totalFundingUsd === 'number') amountUsd = candidate.totalFundingUsd;
    if (amountUsd === null && typeof candidate.latestRoundUsd === 'number') amountUsd = candidate.latestRoundUsd;
    if (amountUsd === null && candidate.fundingOrRevenueText) {
      const parsed = parseFundingDetails(candidate.fundingOrRevenueText);
      if (parsed) amountUsd = parsed.amountUsd;
    }

    if (amountUsd === null) {
      criteria.funding = {
        name: 'Funding',
        category: 'funding',
        active: true,
        status: 'UNKNOWN',
        requiredValue: `${formatUsd(fMin)} – ${formatUsd(fMax)}`,
        actualValue: candidate.fundingOrRevenueText || 'Unverified',
        reason: 'No verifiable funding or revenue figure documented',
        weight: 25,
      };
    } else if (amountUsd > fMax) {
      criteria.funding = {
        name: 'Funding',
        category: 'funding',
        active: true,
        status: 'FAIL',
        requiredValue: `${formatUsd(fMin)} – ${formatUsd(fMax)}`,
        actualValue: formatUsd(amountUsd),
        reason: `Funding ${formatUsd(amountUsd)} exceeds configured maximum ${formatUsd(fMax)}`,
        evidence: candidate.fundingOrRevenueText || candidate.sourceEvidence,
        weight: 25,
      };
    } else if (amountUsd < fMin) {
      criteria.funding = {
        name: 'Funding',
        category: 'funding',
        active: true,
        status: 'FAIL',
        requiredValue: `${formatUsd(fMin)} – ${formatUsd(fMax)}`,
        actualValue: formatUsd(amountUsd),
        reason: `Funding ${formatUsd(amountUsd)} is below configured minimum ${formatUsd(fMin)}`,
        evidence: candidate.fundingOrRevenueText || candidate.sourceEvidence,
        weight: 25,
      };
    } else {
      criteria.funding = {
        name: 'Funding',
        category: 'funding',
        active: true,
        status: 'PASS',
        requiredValue: `${formatUsd(fMin)} – ${formatUsd(fMax)}`,
        actualValue: formatUsd(amountUsd),
        reason: `Funding ${formatUsd(amountUsd)} is within required range ${formatUsd(fMin)} – ${formatUsd(fMax)}`,
        evidence: candidate.fundingOrRevenueText || candidate.sourceEvidence,
        weight: 25,
      };
    }
  }

  // Criterion 4: Industry (Section 17)
  if (isAllIndustries) {
    criteria.industry = {
      name: 'Industry',
      category: 'industry',
      active: false,
      status: 'PASS',
      requiredValue: 'All Industries',
      actualValue: candidate.industry || candidate.rawIndustry || 'All',
      reason: 'All industries allowed — industry is informational',
      weight: 0,
    };
  } else {
    const indCheck = checkIndustryFit(
      candidate.description,
      candidate.industry || candidate.rawIndustry,
      'platform_required',
      industries,
      subIndustries
    );

    if (indCheck.passed) {
      criteria.industry = {
        name: 'Industry',
        category: 'industry',
        active: true,
        status: 'PASS',
        requiredValue: industries.join(', '),
        actualValue: candidate.industry || indCheck.matchedTerm || 'Matched',
        reason: `Industry matches target profile (${indCheck.matchedTerm || candidate.industry})`,
        weight: 20,
      };
    } else {
      criteria.industry = {
        name: 'Industry',
        category: 'industry',
        active: true,
        status: 'FAIL',
        requiredValue: industries.join(', '),
        actualValue: candidate.industry || 'Unknown',
        reason: indCheck.reason || `Business category "${candidate.industry || 'Unknown'}" does not match selected targets (${industries.join(', ')})`,
        weight: 20,
      };
    }
  }

  // Criterion 5: Decision Maker / Executive (CEO / Founder / Co-Founder) (Section 20)
  const rawExec = candidate.founderOrCeoName || candidate.ceoName;
  const isPlaceholderExecutive = !rawExec ||
    /upgrade to unlock|locked|paywall|hidden|unrevealed|see details|view details|n\/a|unknown/i.test(rawExec.trim());

  if (isPlaceholderExecutive) {
    criteria.executive = {
      name: 'Decision Maker',
      category: 'executive',
      active: true,
      status: 'UNKNOWN',
      requiredValue: 'CEO, Founder, or Co-Founder',
      actualValue: 'Paywalled / Undisclosed in source',
      reason: 'Executive identity paywalled / not publicly disclosed in free source',
      weight: 15,
    };
  } else {
    criteria.executive = {
      name: 'Decision Maker',
      category: 'executive',
      active: true,
      status: 'PASS',
      requiredValue: 'CEO, Founder, or Co-Founder',
      actualValue: `${rawExec} (${candidate.founderOrCeoRole || 'Executive'})`,
      reason: `Executive verified: ${rawExec} (${candidate.founderOrCeoRole || 'Executive'})`,
      evidence: candidate.linkedinUrl,
      weight: 15,
    };
  }

  // Criterion 6: Professional Contact & DNS MX (Section 21)
  const isEmailValid = candidate.hasActiveMx === true || candidate.emailVerified === true || candidate.emailStatus === 'valid';
  const isEmailFailed = candidate.hasActiveMx === false || candidate.emailStatus === 'invalid';
  const emailRequired = (target.emailRequirement ?? 'Required') === 'Required';

  if (isEmailValid) {
    criteria.contact = {
      name: 'Corporate Mail Exchange (DNS MX)',
      category: 'contact',
      active: emailRequired,
      status: 'PASS',
      requiredValue: 'Active DNS MX records',
      actualValue: 'Active MX Mail Exchanger Confirmed',
      reason: 'Corporate domain DNS MX mail server verified',
      weight: emailRequired ? 15 : 0,
    };
  } else if (isEmailFailed) {
    criteria.contact = {
      name: 'Corporate Mail Exchange (DNS MX)',
      category: 'contact',
      active: emailRequired,
      status: 'FAIL',
      requiredValue: 'Active DNS MX records',
      actualValue: 'No MX mail exchanger found',
      reason: 'Domain publishes no active DNS MX mail server records',
      weight: emailRequired ? 15 : 0,
    };
  } else {
    criteria.contact = {
      name: 'Corporate Mail Exchange (DNS MX)',
      category: 'contact',
      active: emailRequired,
      status: 'UNKNOWN',
      requiredValue: 'Active DNS MX records',
      actualValue: 'Unverified',
      reason: 'Mail deliverability unverified',
      weight: emailRequired ? 15 : 0,
    };
  }

  // 4. Deterministic Match Percentage (Section 26)
  let totalActiveWeight = 0;
  let earnedPoints = 0;
  const passedCriteria: string[] = [];
  const failedCriteria: string[] = [];
  const conflictedCriteria: string[] = [];
  const unknownCriteria: string[] = [];

  for (const crit of Object.values(criteria)) {
    if (crit.active) {
      totalActiveWeight += crit.weight;
      if (crit.status === 'PASS') {
        earnedPoints += crit.weight;
        passedCriteria.push(crit.reason || `${crit.name} verified`);
      } else if (crit.status === 'FAIL') {
        failedCriteria.push(crit.reason || `${crit.name} failed`);
      } else if (crit.status === 'CONTRADICTED') {
        conflictedCriteria.push(crit.reason || `${crit.name} conflict detected`);
      } else {
        unknownCriteria.push(crit.reason || `${crit.name} unverified`);
      }
    } else {
      if (crit.status === 'PASS') {
        passedCriteria.push(crit.reason || `${crit.name} (Informational)`);
      }
    }
  }

  const matchScore = totalActiveWeight > 0 ? Math.round((earnedPoints / totalActiveWeight) * 100) : 100;
  const matchPercentage = `${matchScore}%`;

  // 5. Final Qualification Verdict (Sections 27, 28)
  let status: 'QUALIFIED' | 'UNDER_REVIEW' | 'REVIEW' | 'REJECTED' = 'UNDER_REVIEW';
  let verdict: 'Qualified' | 'Under Review' | 'Rejected' = 'Under Review';
  let exactReason = '';
  let rejectionReason: string | undefined;
  let reviewReason: string | undefined;

  const hasContradictions = conflictedCriteria.length > 0 || Object.values(criteria).some(c => c.status === 'CONTRADICTED');

  if (failedCriteria.length > 0) {
    status = 'REJECTED';
    verdict = 'Rejected';
    rejectionReason = failedCriteria[0];
    exactReason = failedCriteria.join('; ');
  } else if (hasContradictions || unknownCriteria.length > 0 || candidate.isMismatch) {
    status = 'UNDER_REVIEW';
    verdict = 'Under Review';
    reviewReason = candidate.conflictDetails ||
      (hasContradictions
        ? `Data Conflict: ${conflictedCriteria.join('; ') || 'Verified external evidence conflicts with supplied input record.'} (Under Review)`
        : `Criteria (${unknownCriteria.join(', ')}) require additional verification evidence. Fails closed.`);
    exactReason = reviewReason;
  } else {
    status = 'QUALIFIED';
    verdict = 'Qualified';
    exactReason = 'All mandatory criteria verified with supporting evidence.';
  }

  return {
    qualified: status === 'QUALIFIED',
    status,
    verdict,
    matchScore,
    matchPercentage,
    exactReason,
    rejectionReason,
    reviewReason,
    reasons: failedCriteria.length > 0 ? failedCriteria : (conflictedCriteria.length > 0 ? [...conflictedCriteria, ...unknownCriteria] : (unknownCriteria.length > 0 ? unknownCriteria : passedCriteria)),
    passedCriteria,
    failedCriteria,
    unknownCriteria,
    criteria,
    criteriaChecks: Object.values(criteria),
    checkedAt,
  };
}