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
