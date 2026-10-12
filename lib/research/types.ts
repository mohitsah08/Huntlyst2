/**
 * Huntlyst External: Research & Verification Type Definitions
 * 
 * Strict Architectural Separation:
 * 1. CompanyResearchProfile: Pure factual web extraction with field-level evidence.
 * 2. TargetCriteria: Independent investor/client criteria configuration.
 * 3. VerificationRun: Deterministic evaluation of a saved profile against target criteria.
 */

export type ExtractionMethod = 
  | 'firecrawl_scrape'
  | 'firecrawl_crawl'
  | 'firecrawl_search'
  | 'cheerio_scrape'
  | 'meta_tags'
  | 'structured_json_ld'
  | 'dns_lookup'
  | 'user_correction';

export interface FieldEvidence<T = any> {
  field: string;
  value: T | null;
  sourceUrl: string | null;
  sourceTitle?: string | null;
  sourceTier?: 'TIER_1_OFFICIAL' | 'TIER_2_AUTHORITATIVE' | 'TIER_3_REFERENCE';
  excerpt: string | null;
  dateRetrieved: string;
  extractionMethod: ExtractionMethod;
  confidence: number; // 0 - 100
  isConflict?: boolean;
  competingClaims?: Array<{
    value: any;
    sourceUrl: string;
    excerpt: string;
    dateRetrieved: string;
  }>;
}

export interface DiscoveredExecutive {
  name: string;
  title: string;
  role: 'CEO' | 'Founder' | 'Co-Founder' | 'CTO' | 'CFO' | 'COO' | 'Executive';
  isCurrent: boolean;
  publicProfileUrl?: string | null;
  linkedInUrl?: string | null;
  publicEmail?: string | null;
  evidence?: string | null;
  sourceUrl?: string | null;
  confidence?: number;
}

export interface DiscoveredFundingRound {
  roundType: string;
  amountUsd: number | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  date: string | null;
  investors: string[];
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  evidence?: string | null;
  confidence?: number;
}

export type ResearchStatus = 
  | 'queued'
  | 'researching'
  | 'completed'
  | 'partially_completed'
  | 'failed';

export interface CompanyResearchProfile {
  id: string; // e.g. comp_domain_or_hash
  canonicalDomain: string;
  website: string;
  officialName: string;
  description: string | null;
  
  // Age & Founding
  foundedYear: number | null;
  foundingDate: string | null;
  companyAgeYears: number | null;
  
  // Industry & Model
  primaryIndustry: string | null;
  subIndustry: string | null;
  productsAndServices: string[];
  businessModel: string | null; // B2B, B2C, Enterprise SaaS, etc.
  
  // Geography
  headquarters: {
    city: string | null;
    stateOrRegion: string | null;
    country: string | null;
    address: string | null;
  };
  operatingCountries: string[];
  usPresence: boolean | null;
  
  // Leadership
  leadership: {
    ceo: DiscoveredExecutive | null;
    founders: DiscoveredExecutive[];
    coFounders: DiscoveredExecutive[];
    cto: DiscoveredExecutive | null;
    cfo: DiscoveredExecutive | null;
    seniorExecutives: DiscoveredExecutive[];
    formerExecutives: DiscoveredExecutive[];
  };
  
  // Funding
  funding: {
    totalFundingUsd: number | null;
    latestRoundUsd: number | null;
    latestRoundType: string | null;
    latestRoundDate: string | null;
    investors: string[];
    originalCurrency?: string | null;
    originalAmount?: number | null;
    rounds: DiscoveredFundingRound[];
  };
  
  // Contacts
  contacts: {
    generalEmail: string | null;
    phone: string | null;
    contactPageUrl: string | null;
    executiveEmails: Array<{
      name: string;
      role: string;
      email: string;
      sourceUrl: string;
      sourceExcerpt?: string;
    }>;
    companyLinkedInUrl: string | null;
    companyXUrl: string | null;
  };
  
  // Detailed field-by-field audit & evidence
  fieldEvidence: Record<string, FieldEvidence>;
  sources: Array<{
    url: string;
    title?: string;
    tier: 'TIER_1_OFFICIAL' | 'TIER_2_AUTHORITATIVE' | 'TIER_3_REFERENCE';
    retrievedAt: string;
  }>;
  
  // Execution metadata
  researchStatus: ResearchStatus;
  statusReason?: string;
  researchCompletenessScore: number; // 0 - 100
  createdAt: string;
  updatedAt: string;
}

export interface TargetCriteria {
  id: string;
  name: string;
  version: number;
  
  // Funding constraints (USD)
  fundingMinUsd: number | null;
  fundingMaxUsd: number | null;
  allowedFundingStages: string[];
  
  // Geography constraints
  requiredCountries: string[];
  requiredRegions: string[];
  excludedCountries: string[];
  usPresenceMode: 'non_us_only' | 'minimal_or_none' | 'some_allowed' | 'any';
  
  // Industry constraints
  allowedIndustries: string[];
  allowedSubIndustries: string[];
  
  // Age & Founding constraints
  minCompanyAgeYears?: number | null;
  maxCompanyAgeYears?: number | null;
  minFoundingYear?: number | null;
  maxFoundingYear?: number | null;
  
  // Leadership & Contact constraints
  requireCeo?: boolean;
  requireFounders?: boolean;
  requirePublicEmail?: boolean;
  
  createdAt: string;
  updatedAt: string;
}

export type CriterionOutcome = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface CriterionVerificationResult {
  criterionKey: string;
  name: string;
  status: CriterionOutcome;
  required: string;
  actual: string | null;
  reason: string;
  evidence: string | null;
  sourceUrl: string | null;
}

export type OverallQualificationStatus = 'VERIFIED' | 'REVIEW' | 'UNVERIFIED' | 'REJECTED';

export interface VerificationRun {
  id: string; // verif_comp_id_timestamp
  companyId: string;
  canonicalDomain: string;
  targetCriteriaId: string;
  targetCriteriaVersion: number;
  targetCriteriaName: string;
  
  overallStatus: OverallQualificationStatus;
  qualificationScore: number; // 0 - 100
  summaryReason: string;
  
  criteria: Record<string, CriterionVerificationResult>;
  passedCount: number;
  failedCount: number;
  unknownCount: number;
  
  verifiedAt: string;
  isOutdated?: boolean;
}

export const DEFAULT_TARGET_CRITERIA: TargetCriteria = {
  id: 'tvb_standard_target_criteria',
  name: 'Standard TVB Target Criteria',
  version: 1,
  fundingMinUsd: 1_000_000,
  fundingMaxUsd: 5_000_000,
  allowedFundingStages: ['Seed', 'Series A', 'Pre-Seed', 'Venture Round'],
  requiredCountries: [],
  requiredRegions: ['Western Europe', 'United Kingdom', 'North America'],
  excludedCountries: ['Russia', 'Belarus', 'North Korea', 'Iran'],
  usPresenceMode: 'some_allowed',
  allowedIndustries: ['AI & Machine Learning', 'B2B SaaS', 'FinTech', 'HealthTech', 'Enterprise Software', 'Hardware & Semiconductors'],
  allowedSubIndustries: [],
  minCompanyAgeYears: null,
  maxCompanyAgeYears: 15,
  requireCeo: true,
  requireFounders: false,
  requirePublicEmail: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// =========================================================================
// 4. MAIN CARD STATUS INDICATOR DEFINITIONS (Requirement 2)
// =========================================================================

export type FieldResearchStatus = 
  | 'FOUND' 
  | 'NOT_FOUND' 
  | 'UNDISCLOSED' 
  | 'NOT_SEARCHED' 
  | 'CONFLICTING';

export interface CardFieldStatusItem {
  key: string;
  name: string;
  status: FieldResearchStatus;
  label: string;
  valueDisplay: string;
  isFound: boolean;
  evidence?: string | null;
  sourceUrl?: string | null;
}

export interface CardStatusSummary {
  fields: Record<string, CardFieldStatusItem>;
  foundCount: number;
  totalRequired: number; // 9 key fields
  completenessText: string; // e.g. "7/9 found (78%)"
  completenessPercent: number;
  hasConflicts: boolean;
}

/**
 * Computes status indicators for the 9 key fields on the Main Company Card:
 * 1. Funding (Total cumulative / latest round)
 * 2. Industry
 * 3. Geography
 * 4. Company Age
 * 5. Funding Stage
 * 6. CEO / Founder Info
 * 7. Company Email
 * 8. Executive Professional Email
 * 9. LinkedIn Profile
 * 
 * Rules:
 * - Green check (FOUND): verified fact with supporting evidence
 * - Neutral/amber (NOT_FOUND / UNDISCLOSED): searched but missing/undisclosed
 * - Warning (CONFLICTING): contradictory source data
 * - Gray (NOT_SEARCHED): skipped
 * - A green check means information was found with evidence; it does NOT automatically mean criteria passed!
 */
export function computeCardFieldStatuses(profile: CompanyResearchProfile): CardStatusSummary {
  const fields: Record<string, CardFieldStatusItem> = {};
  let foundCount = 0;
  const totalRequired = 9;

  const isResearched =
    profile.researchStatus === 'completed' ||
    profile.researchStatus === 'partially_completed' ||
    (Boolean(profile.sources) && profile.sources.length > 0);

  // 1. Funding
  const hasFundingVal = profile.funding.totalFundingUsd !== null || profile.funding.latestRoundUsd !== null;
  const hasFundingConflict = profile.fieldEvidence['funding.totalFundingUsd']?.isConflict || profile.fieldEvidence['funding.latestRoundUsd']?.isConflict;
  if (hasFundingConflict) {
    fields.funding = {
      key: 'funding',
      name: 'Funding',
      status: 'CONFLICTING',
      label: 'Conflicting Claims',
      valueDisplay: profile.funding.totalFundingUsd ? `$${(profile.funding.totalFundingUsd / 1e6).toFixed(1)}M (Disputed)` : 'Conflicting Data',
      isFound: false,
      evidence: profile.fieldEvidence['funding.totalFundingUsd']?.excerpt,
      sourceUrl: profile.fieldEvidence['funding.totalFundingUsd']?.sourceUrl,
    };
  } else if (hasFundingVal) {
    const amt = profile.funding.totalFundingUsd ?? profile.funding.latestRoundUsd;
    const isTotal = profile.funding.totalFundingUsd !== null;
    const amtStr = amt! >= 1e9 ? `$${(amt! / 1e9).toFixed(1)}B` : amt! >= 1e6 ? `$${(amt! / 1e6).toFixed(1)}M` : `$${Math.round(amt!).toLocaleString()}`;
    fields.funding = {
      key: 'funding',
      name: 'Funding',
      status: 'FOUND',
      label: isTotal ? 'Total Funding Found' : 'Latest Round Found',
      valueDisplay: isTotal ? `${amtStr} Total` : `${amtStr} Round`,
      isFound: true,
      evidence: profile.fieldEvidence['funding.totalFundingUsd']?.excerpt || profile.fieldEvidence['funding.latestRoundUsd']?.excerpt,
      sourceUrl: profile.fieldEvidence['funding.totalFundingUsd']?.sourceUrl || profile.fieldEvidence['funding.latestRoundUsd']?.sourceUrl,
    };
    foundCount++;
  } else if (isResearched) {
    fields.funding = {
      key: 'funding',
      name: 'Funding',
      status: 'UNDISCLOSED',
      label: 'Undisclosed',
      valueDisplay: 'Undisclosed / Not Disclosed',
      isFound: false,
    };
  } else {
    fields.funding = {
      key: 'funding',
      name: 'Funding',
      status: 'NOT_SEARCHED',
      label: 'Not Searched',
      valueDisplay: 'Unresearched',
      isFound: false,
    };
  }

  // 2. Industry
  if (profile.primaryIndustry) {
    fields.industry = {
      key: 'industry',
      name: 'Industry',
      status: 'FOUND',
      label: 'Industry Verified',
      valueDisplay: profile.subIndustry ? `${profile.primaryIndustry} (${profile.subIndustry})` : profile.primaryIndustry,
      isFound: true,
      evidence: profile.fieldEvidence['primaryIndustry']?.excerpt,
      sourceUrl: profile.fieldEvidence['primaryIndustry']?.sourceUrl,
    };
    foundCount++;
  } else if (isResearched) {
    fields.industry = {
      key: 'industry',
      name: 'Industry',
      status: 'NOT_FOUND',
      label: 'Not Found',
      valueDisplay: 'Unknown Sector',
      isFound: false,
    };
  } else {
    fields.industry = {
      key: 'industry',
      name: 'Industry',
      status: 'NOT_SEARCHED',
      label: 'Not Searched',
      valueDisplay: 'Unresearched',
      isFound: false,
    };
  }

  // 3. Geography
  const hqParts = [profile.headquarters.city, profile.headquarters.stateOrRegion, profile.headquarters.country].filter(Boolean);
  if (profile.headquarters.country || hqParts.length > 0) {
    fields.geography = {
      key: 'geography',
      name: 'Geography',
      status: 'FOUND',
      label: 'Headquarters Found',
      valueDisplay: hqParts.join(', '),
      isFound: true,
      evidence: profile.fieldEvidence['headquarters.country']?.excerpt,
      sourceUrl: profile.fieldEvidence['headquarters.country']?.sourceUrl,
    };
    foundCount++;
  } else if (isResearched) {
    fields.geography = {
      key: 'geography',
      name: 'Geography',
      status: 'UNDISCLOSED',
      label: 'Undisclosed Location',
      valueDisplay: 'Undisclosed',
      isFound: false,
    };
  } else {
    fields.geography = {
      key: 'geography',
      name: 'Geography',
      status: 'NOT_SEARCHED',
      label: 'Not Searched',
      valueDisplay: 'Unresearched',
      isFound: false,
    };
  }

  // 4. Company Age
  if (profile.companyAgeYears !== null || profile.foundedYear !== null) {
    const ageStr = profile.companyAgeYears !== null ? `${profile.companyAgeYears} yrs` : '';
    const yrStr = profile.foundedYear ? `Est. ${profile.foundedYear}` : '';
    fields.companyAge = {
      key: 'companyAge',
      name: 'Company Age',
      status: 'FOUND',
      label: 'Founded Date Found',
      valueDisplay: [ageStr, yrStr].filter(Boolean).join(' • '),
      isFound: true,
      evidence: profile.fieldEvidence['foundedYear']?.excerpt,
      sourceUrl: profile.fieldEvidence['foundedYear']?.sourceUrl,
    };
    foundCount++;
  } else if (isResearched) {
    fields.companyAge = {
      key: 'companyAge',
      name: 'Company Age',
      status: 'UNDISCLOSED',
      label: 'Undisclosed',
      valueDisplay: 'Undisclosed',
      isFound: false,
    };
  } else {
    fields.companyAge = {
      key: 'companyAge',
      name: 'Company Age',
      status: 'NOT_SEARCHED',
      label: 'Not Searched',
      valueDisplay: 'Unresearched',
      isFound: false,
    };
  }

  // 5. Funding Stage
  if (profile.funding.latestRoundType) {
    fields.fundingStage = {
      key: 'fundingStage',
      name: 'Funding Stage',
      status: 'FOUND',
      label: 'Stage Identified',
      valueDisplay: profile.funding.latestRoundType,
      isFound: true,
      evidence: profile.fieldEvidence['funding.latestRoundType']?.excerpt,
      sourceUrl: profile.fieldEvidence['funding.latestRoundType']?.sourceUrl,
    };
    foundCount++;
  } else if (isResearched) {
    fields.fundingStage = {
      key: 'fundingStage',
      name: 'Funding Stage',
      status: 'UNDISCLOSED',
      label: 'Stage Undisclosed',
      valueDisplay: 'Undisclosed',
      isFound: false,
    };
  } else {
    fields.fundingStage = {
      key: 'fundingStage',
      name: 'Funding Stage',
      status: 'NOT_SEARCHED',
      label: 'Not Searched',
      valueDisplay: 'Unresearched',
      isFound: false,
    };
  }

  // 6. CEO / Founder Info
  const ceoName = profile.leadership.ceo?.name;
  const founderNames = profile.leadership.founders.map(f => f.name);
  if (ceoName || founderNames.length > 0) {
    fields.leadership = {
      key: 'leadership',
      name: 'CEO / Founders',
      status: 'FOUND',
      label: 'Leadership Identified',
      valueDisplay: ceoName ? `${ceoName} (CEO)` : `Founders: ${founderNames.slice(0, 2).join(', ')}`,
      isFound: true,
      evidence: profile.leadership.ceo?.evidence || profile.fieldEvidence['leadership.ceo']?.excerpt,
      sourceUrl: profile.leadership.ceo?.sourceUrl || profile.fieldEvidence['leadership.ceo']?.sourceUrl,
    };
    foundCount++;
  } else if (isResearched) {
    fields.leadership = {
      key: 'leadership',
      name: 'CEO / Founders',
      status: 'NOT_FOUND',
      label: 'Leadership Not Found',
      valueDisplay: 'Not Disclosed',
      isFound: false,
    };
  } else {
    fields.leadership = {
      key: 'leadership',
      name: 'CEO / Founders',
      status: 'NOT_SEARCHED',
      label: 'Not Searched',
      valueDisplay: 'Unresearched',
      isFound: false,
    };
  }

  // 7. Company Email
  if (profile.contacts.generalEmail) {
    fields.companyEmail = {
      key: 'companyEmail',
      name: 'Company Email',
      status: 'FOUND',
      label: 'Company Email Verified',
      valueDisplay: profile.contacts.generalEmail,
      isFound: true,
      evidence: profile.fieldEvidence['contacts.generalEmail']?.excerpt,
      sourceUrl: profile.fieldEvidence['contacts.generalEmail']?.sourceUrl,
    };
    foundCount++;
  } else if (profile.contacts.contactPageUrl) {
    fields.companyEmail = {
      key: 'companyEmail',
      name: 'Company Email',
      status: 'NOT_FOUND',
      label: 'Contact Form Only',
      valueDisplay: 'Web Form (No Direct Email)',
      isFound: false,
      sourceUrl: profile.contacts.contactPageUrl,
    };
  } else if (isResearched) {
    fields.companyEmail = {
      key: 'companyEmail',
      name: 'Company Email',
      status: 'NOT_FOUND',
      label: 'No Public Email',
      valueDisplay: 'Not Found',
      isFound: false,
    };
  } else {
    fields.companyEmail = {
      key: 'companyEmail',
      name: 'Company Email',
      status: 'NOT_SEARCHED',
      label: 'Not Searched',
      valueDisplay: 'Unresearched',
      isFound: false,
    };
  }

  // 8. Executive Professional Email
  const execEmails = profile.contacts.executiveEmails;
  const ceoEmail = profile.leadership.ceo?.publicEmail;
  if (execEmails.length > 0 || ceoEmail) {
    const emailToShow = ceoEmail || execEmails[0].email;
    const personToShow = ceoEmail ? (profile.leadership.ceo?.name || 'CEO') : execEmails[0].name;
    fields.executiveEmail = {
      key: 'executiveEmail',
      name: 'Executive Email',
      status: 'FOUND',
      label: 'Executive Email Found',
      valueDisplay: `${emailToShow} (${personToShow})`,
      isFound: true,
      sourceUrl: ceoEmail ? profile.leadership.ceo?.sourceUrl : execEmails[0].sourceUrl,
    };
    foundCount++;
  } else if (isResearched) {
    fields.executiveEmail = {
      key: 'executiveEmail',
      name: 'Executive Email',
      status: 'NOT_FOUND',
      label: 'Not Publicly Listed',
      valueDisplay: 'Not Disclosed (No guess)',
      isFound: false,
    };
  } else {
    fields.executiveEmail = {
      key: 'executiveEmail',
      name: 'Executive Email',
      status: 'NOT_SEARCHED',
      label: 'Not Searched',
      valueDisplay: 'Unresearched',
      isFound: false,
    };
  }

  // 9. LinkedIn Profile
  const companyLi = profile.contacts.companyLinkedInUrl;
  const execLi = profile.leadership.ceo?.linkedInUrl || profile.leadership.ceo?.publicProfileUrl;
  if (companyLi || execLi) {
    fields.linkedInProfile = {
      key: 'linkedInProfile',
      name: 'LinkedIn Profile',
      status: 'FOUND',
      label: 'LinkedIn Available',
      valueDisplay: companyLi ? 'Company Page' : 'Executive Profile',
      isFound: true,
      sourceUrl: companyLi || execLi || null,
    };
    foundCount++;
  } else if (isResearched) {
    fields.linkedInProfile = {
      key: 'linkedInProfile',
      name: 'LinkedIn Profile',
      status: 'NOT_FOUND',
      label: 'Not Found',
      valueDisplay: 'No Public LinkedIn',
      isFound: false,
    };
  } else {
    fields.linkedInProfile = {
      key: 'linkedInProfile',
      name: 'LinkedIn Profile',
      status: 'NOT_SEARCHED',
      label: 'Not Searched',
      valueDisplay: 'Unresearched',
      isFound: false,
    };
  }

  const completenessPercent = Math.round((foundCount / totalRequired) * 100);

  return {
    fields,
    foundCount,
    totalRequired,
    completenessText: `${foundCount}/${totalRequired} found (${completenessPercent}%)`,
    completenessPercent,
    hasConflicts: Boolean(hasFundingConflict),
  };
}

