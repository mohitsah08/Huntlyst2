/**
 * Phase 1: Internal Normalization & Field Availability Classifier
 * 
 * Responsibilities:
 * - Deterministic, rule-based column header matching
 * - Field-level normalization and validation
 * - 4-State Availability classification: AVAILABLE | MISSING | INVALID | AMBIGUOUS
 * - Preserves 100% of raw fields untouched
 * - Preserves unmapped fields
 * - Zero hallucination / no guessing or appending fake URLs/data
 */

import {
  CanonicalFieldKey,
  CanonicalCompanyFields,
  FieldAvailabilityDetail,
  Phase1CompanyRecord,
  Phase1ColumnMapping,
} from './phase1Types';

// Current reference year
const CURRENT_YEAR = new Date().getFullYear();

// Common paywall, redaction, and placeholder values
const PLACEHOLDER_PATTERNS = [
  /^upgrade\s+to\s+unlock/i,
  /^unlock\s+to\s+view/i,
  /^premium\s+only/i,
  /^pro\s+feature/i,
  /^paid\s+plan/i,
  /^n\/?a$/i,
  /^not\s+applicable$/i,
  /^tbd$/i,
  /^tba$/i,
  /^to\s+be\s+determined$/i,
  /^to\s+be\s+announced$/i,
  /^none$/i,
  /^null$/i,
  /^undefined$/i,
  /^unknown$/i,
  /^not\s+specified$/i,
  /^undisclosed$/i,
  /^confidential$/i,
  /^hidden$/i,
  /^\[redacted\]$/i,
  /^redacted$/i,
  /^[-–—.]+$/,
];

// Ambiguous or generic geography designations
const AMBIGUOUS_GEO_PATTERNS = [
  /^global$/i,
  /^worldwide$/i,
  /^international$/i,
  /^everywhere$/i,
  /^earth$/i,
  /^multiple$/i,
  /^various$/i,
  /^remote$/i,
  /^distributed$/i,
];

// Synonyms map for header detection
const HEADER_SYNONYMS: Record<CanonicalFieldKey, string[]> = {
  companyName: [
    'company',
    'company name',
    'name',
    'organization',
    'organisation',
    'org name',
    'business name',
    'startup',
    'startup name',
    'legal name',
    'firm',
    'firm name',
    'entity name',
    'brand',
    'brand name',
    'title',
  ],
  website: [
    'website',
    'company website',
    'domain',
    'url',
    'company url',
    'web',
    'homepage',
    'site',
    'web address',
    'link',
    'website url',
  ],
  canonicalDomain: [
    'canonical domain',
    'domain name',
    'clean domain',
    'root domain',
  ],
  industry: [
    'industry',
    'sector',
    'category',
    'categories',
    'vertical',
    'sub-industry',
    'sub industry',
    'business type',
    'market',
    'domain area',
    'niche',
    'industry sector',
    'primary industry',
  ],
  geography: [
    'geography',
    'country',
    'location',
    'headquarters',
    'hq',
    'region',
    'city',
    'state',
    'country/region',
    'hq location',
    'hq country',
    'territory',
    'nation',
    'address',
    'headquarters location',
  ],
  foundingYear: [
    'founding year',
    'founded year',
    'founded',
    'year founded',
    'year established',
    'established',
    'incorporation year',
    'founding date',
    'founded date',
    'establishment year',
  ],
  companyAge: [
    'company age',
    'age',
    'years active',
    'years in business',
    'age (years)',
    'operating years',
  ],
  companyStage: [
    'company stage',
    'stage',
    'maturity',
    'growth stage',
    'company phase',
    'business stage',
    'corporate stage',
  ],
  totalFundingAmount: [
    'total funding amount',
    'total funding',
    'total raised',
    'funding amount',
    'amount raised',
    'total capital',
    'funding in usd',
    'funding (usd)',
    'total funding (usd)',
    'raised',
    'capital raised',
    'funding amount (in usd)',
    'total funding (in millions)',
    'funding',
  ],
  latestFundingRoundAmount: [
    'latest funding round amount',
    'latest round amount',
    'last round amount',
    'latest funding amount',
    'recent funding amount',
    'latest round size',
    'last round size',
    'recent round amount',
    'last funding amount',
  ],
  fundingStage: [
    'funding stage',
    'funding round',
    'round',
    'latest round',
    'series',
    'investment stage',
    'last funding round',
    'last round',
    'funding type',
    'round type',
  ],
};

/**
 * Standardizes a column name for comparison
 */
export function normalizeHeaderString(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\-_/\\()[\].:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects whether a string is a placeholder or paywall indicator
 */
export function isPlaceholderValue(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  const str = String(val).trim();
  if (!str) return false;
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Clean canonical domain extractor
 */
export function extractCleanDomain(urlOrDomain: string): string | null {
  const clean = urlOrDomain.trim().toLowerCase();
  if (!clean || clean.includes(' ') || clean.includes('@')) return null;

  try {
    let hostname = clean;
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      hostname = new URL(clean).hostname;
    } else {
      // Remove paths/query strings if present without protocol
      hostname = clean.split('/')[0].split('?')[0].split('#')[0];
    }

    hostname = hostname.replace(/^www\./i, '');
    if (!hostname.includes('.')) return null;
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Formats monetary amounts into clean display strings
 */
export function formatCurrencyString(rawStr: string): { formatted: string; numericUsd?: number } | null {
  const clean = rawStr.trim();
  if (!clean) return null;

  // Check if starts with currency symbol or contains numbers
  const hasDigits = /\d/.test(clean);
  if (!hasDigits) return null;

  // Remove commas
  const noCommas = clean.replace(/,/g, '');

  // Extract multiplier
  let multiplier = 1;
  if (/m(illion)?\b/i.test(noCommas)) multiplier = 1_000_000;
  else if (/k(k)?\b|thousand/i.test(noCommas)) multiplier = 1_000;
  else if (/b(illion)?\b/i.test(noCommas)) multiplier = 1_000_000_000;
  else if (/cr(ore)?\b/i.test(noCommas)) multiplier = 10_000_000;
  else if (/l(akh)?\b/i.test(noCommas)) multiplier = 100_000;

  const matchNum = noCommas.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!matchNum) return null;

  const parsedNum = parseFloat(matchNum[0]);
  if (isNaN(parsedNum)) return null;

  const numericValue = parsedNum * multiplier;

  // Determine currency symbol
  let symbol = '$';
  if (clean.includes('€') || /eur/i.test(clean)) symbol = '€';
  else if (clean.includes('£') || /gbp/i.test(clean)) symbol = '£';
  else if (clean.includes('₹') || /inr|rs/i.test(clean)) symbol = '₹';
  else if (clean.includes('A$') || /aud/i.test(clean)) symbol = 'A$';

  return {
    formatted: `${symbol}${numericValue.toLocaleString('en-US')}`,
    numericUsd: symbol === '$' ? numericValue : undefined,
  };
}

/**
 * Inspects column headers and maps them to canonical fields
 */
export function mapColumnHeaders(headers: string[]): {
  mappings: Phase1ColumnMapping[];
  unmappedColumns: string[];
} {
  const mappings: Phase1ColumnMapping[] = [];
  const mappedCanonical = new Set<CanonicalFieldKey>();
  const unmappedColumns: string[] = [];

  for (const header of headers) {
    const norm = normalizeHeaderString(header);
    let matchedKey: CanonicalFieldKey | null = null;

    for (const [canonicalKey, synonyms] of Object.entries(HEADER_SYNONYMS) as [CanonicalFieldKey, string[]][]) {
      // Prioritize unmapped canonical slots
      if (mappedCanonical.has(canonicalKey)) continue;

      const directMatch = synonyms.some(syn => norm === syn);
      if (directMatch) {
        matchedKey = canonicalKey;
        break;
      }
    }

    // Secondary pass: substring matching if exact match not found
    if (!matchedKey) {
      for (const [canonicalKey, synonyms] of Object.entries(HEADER_SYNONYMS) as [CanonicalFieldKey, string[]][]) {
        if (mappedCanonical.has(canonicalKey)) continue;

        const subMatch = synonyms.some(syn => norm.includes(syn) || syn.includes(norm));
        if (subMatch) {
          matchedKey = canonicalKey;
          break;
        }
      }
    }

    if (matchedKey) {
      mappedCanonical.add(matchedKey);
      mappings.push({
        sourceColumn: header,
        mappedField: matchedKey,
        isCustom: false,
      });
    } else {
      mappings.push({
        sourceColumn: header,
        mappedField: null,
        isCustom: true,
      });
      unmappedColumns.push(header);
    }
  }

  return { mappings, unmappedColumns };
}

/**
 * Validates and classifies Company Name
 */
function classifyCompanyName(rawVal: unknown): FieldAvailabilityDetail<string> {
  const issues: string[] = [];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  const str = String(rawVal).trim();

  if (isPlaceholderValue(str)) {
    issues.push(`Contains placeholder or paywall text: "${str}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  // Check if completely made of punctuation or invalid characters
  if (/^[^a-zA-Z0-9]+$/.test(str)) {
    issues.push('Company name contains only symbols or punctuation');
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  return { status: 'AVAILABLE', value: str, rawValue: rawVal, issues: [], normalizedDisplay: str };
}

/**
 * Validates and classifies Website / URL
 */
function classifyWebsite(rawVal: unknown): FieldAvailabilityDetail<string> {
  const issues: string[] = [];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  const str = String(rawVal).trim();

  if (isPlaceholderValue(str)) {
    issues.push(`Contains placeholder or paywall text: "${str}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  if (str.includes('@')) {
    issues.push('Email address provided in website field');
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  if (str.includes(' ') || str.includes('\t') || str.includes('\n')) {
    issues.push('Website URL contains illegal whitespace');
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  if (!str.includes('.')) {
    issues.push('Website URL is missing domain extension or dot');
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  const cleanDomain = extractCleanDomain(str);
  if (!cleanDomain) {
    issues.push('Invalid domain format or unparseable URL structure');
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  // Normalize protocol
  const normalizedUrl = str.startsWith('http://') || str.startsWith('https://') ? str : `https://${str}`;
  return { status: 'AVAILABLE', value: normalizedUrl, rawValue: rawVal, issues: [], normalizedDisplay: normalizedUrl };
}

/**
 * Validates and classifies Canonical Domain
 */
function classifyCanonicalDomain(rawVal: unknown, websiteVal?: string | null): FieldAvailabilityDetail<string> {
  const issues: string[] = [];
  const rawStr = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';

  if (rawStr && isPlaceholderValue(rawStr)) {
    issues.push(`Domain contains placeholder: "${rawStr}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: rawStr };
  }

  const candidate = rawStr || websiteVal || '';
  if (!candidate) {
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  const clean = extractCleanDomain(candidate);
  if (!clean) {
    issues.push('Unable to extract clean canonical domain');
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: candidate };
  }

  return { status: 'AVAILABLE', value: clean, rawValue: rawVal, issues: [], normalizedDisplay: clean };
}

/**
 * Validates and classifies Industry
 */
function classifyIndustry(rawVal: unknown): FieldAvailabilityDetail<string> {
  const issues: string[] = [];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  const str = String(rawVal).trim();

  if (isPlaceholderValue(str)) {
    issues.push(`Industry contains placeholder: "${str}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  return { status: 'AVAILABLE', value: str, rawValue: rawVal, issues: [], normalizedDisplay: str };
}

/**
 * Validates and classifies Geography
 */
function classifyGeography(rawVal: unknown): FieldAvailabilityDetail<string> {
  const issues: string[] = [];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  const str = String(rawVal).trim();

  if (isPlaceholderValue(str)) {
    issues.push(`Geography contains placeholder: "${str}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  if (AMBIGUOUS_GEO_PATTERNS.some(p => p.test(str))) {
    issues.push(`Ambiguous generic geography: "${str}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  return { status: 'AVAILABLE', value: str, rawValue: rawVal, issues: [], normalizedDisplay: str };
}

/**
 * Validates and classifies Founding Year
 */
function classifyFoundingYear(rawVal: unknown): FieldAvailabilityDetail<number> {
  const issues: string[] = [];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  const str = String(rawVal).trim();

  if (isPlaceholderValue(str)) {
    issues.push(`Founding year contains placeholder: "${str}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  // Look for 4 digit year
  const match = str.match(/\b(1[7-9]\d{2}|20\d{2})\b/);
  if (!match) {
    issues.push(`Unable to parse valid 4-digit founding year from "${str}"`);
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  const year = parseInt(match[0], 10);
  if (year > CURRENT_YEAR) {
    issues.push(`Founding year ${year} is in the future (current year: ${CURRENT_YEAR})`);
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: String(year) };
  }

  if (year < 1700) {
    issues.push(`Founding year ${year} is outside reasonable operational range (1700 - present)`);
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: String(year) };
  }

  return { status: 'AVAILABLE', value: year, rawValue: rawVal, issues: [], normalizedDisplay: String(year) };
}

/**
 * Validates and classifies Company Age
 */
function classifyCompanyAge(rawVal: unknown, foundingYear?: number | null): FieldAvailabilityDetail<number> {
  const issues: string[] = [];
  const rawStr = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';

  if (rawStr && isPlaceholderValue(rawStr)) {
    issues.push(`Company age contains placeholder: "${rawStr}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: rawStr };
  }

  let parsedExplicitAge: number | null = null;
  if (rawStr) {
    const numMatch = rawStr.match(/[-+]?[0-9]+/);
    if (numMatch) {
      const ageNum = parseInt(numMatch[0], 10);
      if (ageNum < 0) {
        issues.push(`Company age cannot be negative: ${ageNum}`);
        return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: rawStr };
      }
      if (ageNum > 300) {
        issues.push(`Company age ${ageNum} is outside reasonable bounds`);
        return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: rawStr };
      }
      parsedExplicitAge = ageNum;
    } else {
      issues.push(`Non-numeric company age value: "${rawStr}"`);
      return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: rawStr };
    }
  }

  // Derive from founding year if not explicitly supplied
  if (parsedExplicitAge === null) {
    if (foundingYear && foundingYear <= CURRENT_YEAR) {
      const calculatedAge = CURRENT_YEAR - foundingYear;
      return {
        status: 'AVAILABLE',
        value: calculatedAge,
        rawValue: rawVal ?? `Derived from founding year (${foundingYear})`,
        issues: [],
        normalizedDisplay: `${calculatedAge} year${calculatedAge === 1 ? '' : 's'} (derived)`,
      };
    }
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  // Cross-validate explicit age against founding year if both exist
  if (foundingYear) {
    const expectedAge = CURRENT_YEAR - foundingYear;
    if (Math.abs(expectedAge - parsedExplicitAge) > 2) {
      issues.push(`Explicit age (${parsedExplicitAge} yrs) conflicts with founding year ${foundingYear} (expected ~${expectedAge} yrs)`);
      return {
        status: 'AMBIGUOUS',
        value: parsedExplicitAge,
        rawValue: rawVal,
        issues,
        normalizedDisplay: `${parsedExplicitAge} yrs (conflicts with ${foundingYear})`,
      };
    }
  }

  return {
    status: 'AVAILABLE',
    value: parsedExplicitAge,
    rawValue: rawVal,
    issues: [],
    normalizedDisplay: `${parsedExplicitAge} year${parsedExplicitAge === 1 ? '' : 's'}`,
  };
}

/**
 * Validates and classifies Company Stage
 */
function classifyCompanyStage(rawVal: unknown): FieldAvailabilityDetail<string> {
  const issues: string[] = [];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  const str = String(rawVal).trim();

  if (isPlaceholderValue(str)) {
    issues.push(`Company stage contains placeholder: "${str}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  return { status: 'AVAILABLE', value: str, rawValue: rawVal, issues: [], normalizedDisplay: str };
}

/**
 * Validates and classifies Total Funding Amount
 */
function classifyFundingAmount(rawVal: unknown, label: string = 'Total Funding'): FieldAvailabilityDetail<string> {
  const issues: string[] = [];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  const str = String(rawVal).trim();

  if (isPlaceholderValue(str)) {
    issues.push(`${label} contains placeholder or undisclosed marker: "${str}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  // Check for negative signs
  if (str.startsWith('-') || str.includes('negative')) {
    issues.push(`${label} cannot be negative: "${str}"`);
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  const formatted = formatCurrencyString(str);
  if (!formatted) {
    issues.push(`Unable to parse numeric or currency amount from "${str}"`);
    return { status: 'INVALID', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  return {
    status: 'AVAILABLE',
    value: formatted.formatted,
    rawValue: rawVal,
    issues: [],
    normalizedDisplay: formatted.formatted,
  };
}

/**
 * Validates and classifies Funding Stage / Round
 */
function classifyFundingStage(rawVal: unknown): FieldAvailabilityDetail<string> {
  const issues: string[] = [];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { status: 'MISSING', value: null, rawValue: rawVal, issues: [] };
  }

  const str = String(rawVal).trim();

  if (isPlaceholderValue(str)) {
    issues.push(`Funding stage contains placeholder: "${str}"`);
    return { status: 'AMBIGUOUS', value: null, rawValue: rawVal, issues, normalizedDisplay: str };
  }

  return { status: 'AVAILABLE', value: str, rawValue: rawVal, issues: [], normalizedDisplay: str };
}

/**
 * Normalizes a single row of raw data into canonical fields with availability classification
 */
export function normalizeCompanyRow(
  rawRow: Record<string, any>,
  rowIndex: number,
  columnMappings: Phase1ColumnMapping[]
): Phase1CompanyRecord | null {
  // Check if completely empty row
  const entries = Object.entries(rawRow);
  const hasContent = entries.some(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  if (!hasContent) {
    return null;
  }

  // Find mapped values from row
  const mappedValues: Partial<Record<CanonicalFieldKey, any>> = {};
  const unmappedFields: Record<string, any> = {};

  for (const [colName, val] of entries) {
    const mapping = columnMappings.find(m => m.sourceColumn === colName);
    if (mapping && mapping.mappedField) {
      // If canonical field hasn't been set yet or was empty, set it
      if (mappedValues[mapping.mappedField] === undefined || mappedValues[mapping.mappedField] === '') {
        mappedValues[mapping.mappedField] = val;
      }
    } else {
      unmappedFields[colName] = val;
    }
  }

  // 1. Company Name
  const companyName = classifyCompanyName(mappedValues.companyName);

  // 2. Website
  const website = classifyWebsite(mappedValues.website);

  // 3. Canonical Domain (uses explicit domain or derived from website)
  const canonicalDomain = classifyCanonicalDomain(mappedValues.canonicalDomain, website.value);

  // 4. Industry
  const industry = classifyIndustry(mappedValues.industry);

  // 5. Geography
  const geography = classifyGeography(mappedValues.geography);

  // 6. Founding Year
  const foundingYear = classifyFoundingYear(mappedValues.foundingYear);

  // 7. Company Age (uses explicit age or derived from founding year)
  const companyAge = classifyCompanyAge(mappedValues.companyAge, foundingYear.value);

  // 8. Company Stage
  const companyStage = classifyCompanyStage(mappedValues.companyStage);

  // 9. Total Funding Amount
  const totalFundingAmount = classifyFundingAmount(mappedValues.totalFundingAmount, 'Total Funding');

  // 10. Latest Funding Round Amount
  const latestFundingRoundAmount = classifyFundingAmount(mappedValues.latestFundingRoundAmount, 'Latest Round');

  // 11. Funding Stage / Round
  const fundingStage = classifyFundingStage(mappedValues.fundingStage);

  const canonicalFields: CanonicalCompanyFields = {
    companyName,
    website,
    canonicalDomain,
    industry,
    geography,
    foundingYear,
    companyAge,
    companyStage,
    totalFundingAmount,
    latestFundingRoundAmount,
    fundingStage,
  };

  // Summarize field availability
  const fields = Object.values(canonicalFields) as FieldAvailabilityDetail[];
  let availableCount = 0;
  let missingCount = 0;
  let invalidCount = 0;
  let ambiguousCount = 0;

  for (const f of fields) {
    if (f.status === 'AVAILABLE') availableCount++;
    else if (f.status === 'MISSING') missingCount++;
    else if (f.status === 'INVALID') invalidCount++;
    else if (f.status === 'AMBIGUOUS') ambiguousCount++;
  }

  const hasErrors = invalidCount > 0;
  const hasAmbiguities = ambiguousCount > 0;

  // Readiness status
  let readiness: 'READY' | 'ATTENTION_NEEDED' | 'INCOMPLETE' = 'READY';
  if (companyName.status === 'MISSING' || companyName.status === 'INVALID') {
    readiness = 'INCOMPLETE';
  } else if (hasErrors || hasAmbiguities) {
    readiness = 'ATTENTION_NEEDED';
  }

  // Generate deterministic ID
  const domainPart = canonicalDomain.value || (companyName.value ? companyName.value.toLowerCase().replace(/[^a-z0-9]/g, '_') : `row_${rowIndex}`);
  const companyId = `comp_${domainPart}_${rowIndex}`;

  return {
    companyId,
    rowIndex,
    rawFields: { ...rawRow },
    unmappedFields,
    canonicalFields,
    summary: {
      availableCount,
      missingCount,
      invalidCount,
      ambiguousCount,
      totalCanonicalFields: fields.length,
      hasErrors,
      hasAmbiguities,
      readiness,
    },
  };
}
