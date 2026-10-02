/**
 * Core types for the TVB Company Discovery Agent
 */

import type { CompanyContactProfile } from './contactTypes';

export interface CandidateUrl {
  url: string;
  snippet: string;
  source: string;
}

export interface DiscoverySource {
  name: string;
  discover(): Promise<{ url: string; snippet: string }[]>;
}

export interface ExtractedCompanyData {
  name: string | null;
  description: string | null;
  industry: string | null;
  fundingOrRevenueText: string | null;
  usPresenceEvidence: string | null;
  founderOrCeoName: string | null;
  country?: string | null;
  headquarters?: string | null;
}

export interface ValidatedCompany {
  name: string;
  website: string;
  description: string | null;
  industry: string | null;
  fundingOrRevenueText: string | null;
  usPresenceEvidence: string | null;
  founderOrCeoName: string | null;
  sourceType: string;
  country?: string | null;
  headquarters?: string | null;
}

export type VerificationStatusType = 'VERIFIED' | 'PARTIALLY VERIFIED' | 'UNVERIFIED' | 'REJECTED' | 'UNKNOWN';
export type StandardDeliverabilityStatus = 'valid' | 'invalid' | 'risky' | 'catch-all' | 'unavailable' | 'unknown' | 'pending';

export interface EmailVerificationResult {
  email: string | null;
  verified: boolean;
  status: VerificationStatusType;
  deliverabilityStatus?: StandardDeliverabilityStatus;
  emailType?: 'professional' | 'personal' | 'generic' | 'unknown';
  domain?: string | null;
  companyDomain?: string | null;
  domainMatchesCompany?: boolean;
  hasMx?: boolean;
  mxHost?: string | null;
  method?: string;
  evidence?: string | null;
  timestamp?: string;
  reason?: string;
}

export type CompanyRecord = {
  name: string;
  website: string;
  description: string | null;
  industry: string | null;
  fundingOrRevenue: string | null;
  // Three distinct funding dimensions (Sections 7-9)
  fundingAmount?: string | number | null;
  fundingDate?: string | null;
  fundingType?: string | null;
  totalFundingUsd?: number | null;
  latestRoundUsd?: number | null;
  latestRoundDate?: string | null;
  latestRoundType?: string | null;
  fundingVerificationStatus?: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'CONFLICT' | 'UNVERIFIED' | 'UNKNOWN';
  fundingConflictReason?: string;
  sourceFundingAmount?: string | null;
  sourceFundingDate?: string | null;
  sourceFundingType?: string | null;
  verifiedFundingAmount?: string | null;
  verifiedFundingDate?: string | null;
  verifiedFundingType?: string | null;

  usPresence?: boolean | null; // legacy backwards compatibility
  founderOrCeoName: string | null;
  founderOrCeoEmail: string | null;
  emailVerified: boolean;
  contactVerificationStatus?: VerificationStatusType;
  contactVerificationReason?: string;
  confidenceScore: number;
  huntScore?: number; // 0–100 derived qualification score
  scoreBreakdown?: {
    funding: number; // max 20
    technology: number; // max 20
    geography: number; // max 20
    founder: number; // max 20
    contact: number; // max 20
  };
  sourceType: string;
  country?: string | null;
  headquarters?: string | null;
  linkedinUrl?: string | null;
  companyLinkedinUrl?: string | null;
  sourceUrls?: string[];
  auditDetails?: {
    fundingStatus: string;
    locationStatus: string;
    techStatus: string;
    emailStatus: string;
    contactStatus?: string;
    rawEvidence?: string;
  };
  // Normalized & enriched fields for complete view interoperability
  sector?: string;
  location?: string;
  employeeCount?: string | number;
  funding?: {
    totalRaised?: string;
    stage?: string;
    lastRoundDate?: string;
    investors?: string[];
    revenue?: string;
    source?: string;
  };
  validation?: {
    isTechPlatform?: boolean;
    hasMinFunding?: boolean;
    isNonUS?: boolean;
    hasFounder?: boolean;
    hasVerifiedEmail?: boolean;
    overallQualified?: boolean;
    confidenceScore?: number;
    checks?: {
      funding?: { passed?: boolean; evidence?: string };
      technology?: { passed?: boolean; evidence?: string };
      geography?: { passed?: boolean; usPresence?: string; evidence?: string };
      founder?: { passed?: boolean; evidence?: string };
      email?: { passed?: boolean; evidence?: string };
    };
  };
  founder?: {
    name?: string;
    title?: string;
    linkedinUrl?: string;
    confidence?: number;
  };
  email?: {
    address?: string;
    status?: string;
    pattern?: string;
    mxRecord?: string;
    confidence?: number;
  };
  evidence?: {
    fundingSource?: string;
    techEvidence?: string;
    geoEvidence?: string;
    founderSource?: string;
    emailVerificationDetail?: string;
    sources?: string[];
  };
  // Freshness & Activity Tracking (Section 24)
  firstDiscoveredAt?: string;
  lastSeenAt?: string;
  lastVerifiedAt?: string;
  lastUpdatedAt?: string;
  statusTag?: 'NEW' | 'UPDATED' | 'UNCHANGED' | 'PREVIOUSLY_DISCOVERED';
  // Contact & Decision-Maker Profile (Sections 1–22)
  contactProfile?: CompanyContactProfile;
  // Gold Reference & Verification Benchmark Interoperability (Sections 16, 24)
  referenceStatus?: 'QUALIFIED' | 'UNQUALIFIED';
  targetProfileStatus?: 'PASS' | 'FAIL' | 'REVIEW';
  huntlystVerificationStatus?: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNDER_REVIEW' | 'UNVERIFIED';
  benchmarkChecks?: {
    company?: boolean;
    website?: boolean;
    funding?: boolean;
    industry?: boolean;
    companyLinkedin?: boolean;
    companyTwitter?: boolean;
    ceo?: boolean;
    ceoLinkedin?: boolean;
    professionalEmail?: boolean;
  };
  mismatchReason?: string;
  rootCause?: string;
  fieldAudits?: Record<string, any>;
  divergences?: string[];
  rejectionStage?: string;
};

export type {
  CompanyContactProfile,
  DecisionMakerContact,
  BestContactPath,
  ContactCompleteness,
  ContactVerificationStatus,
  VerifiedField,
} from './contactTypes';


export interface RejectedCompanyRecord {
  name: string;
  website?: string;
  industry?: string;
  fundingOrRevenue?: string;
  location?: string;
  founderOrCeoName?: string;
  rejectionReasons: string[];
  matchedRules: string[];
  failedRules: string[];
  sourceEvidence?: string;
  firstDiscoveredAt?: string;
  lastSeenAt?: string;
  lastVerifiedAt?: string;
  lastUpdatedAt?: string;
}

export interface RunAgentResult {
  companies: CompanyRecord[];
  rejectedCompanies?: RejectedCompanyRecord[];
  totalDiscovered: number;
  totalQualified: number;
  stats?: {
    discovered: number;
    extracted: number;
    nonUsPassed: number;
    fundingQualified: number;
    founderFound: number;
    contactsChecked?: number;
    emailVerified: number;
    emailsPartiallyVerified?: number;
    emailsUnverified?: number;
    finalRanked: number;
    durationMs: number;
    totalNew?: number;
    totalPreviouslySeen?: number;
    duplicatesRemoved?: number;
  };
}

export interface ProgressStage {
  stage: string;
  message: string;
  completed: boolean;
  current: number;
  total: number;
}

export interface PipelineStreamEvent {
  type: 'log' | 'progress' | 'candidate_found' | 'company_qualified' | 'complete' | 'error';
  timestamp: string;
  message: string;
  stage?: number;
  stageName?: string;
  huntId?: string;
  stats?: RunAgentResult['stats'];
  company?: CompanyRecord;
  result?: RunAgentResult;
  error?: string;
}

export interface RunHistoryItem {
  id: string;
  timestamp: string;
  requestedCount: number;
  discoveredCount: number;
  extractedCount: number;
  qualifiedCount: number;
  rejectedCount: number;
  verifiedEmailsCount: number;
  durationSeconds: number;
  status: 'Completed' | 'Degraded' | 'Failed';
  sector: string;
  companies: CompanyRecord[];
  rejectedCompanies?: RejectedCompanyRecord[];
}

export interface SettingsConfig {
  agent: {
    targetLeadsCount: number;
    minFunding: number;
    maxFunding: number;
    techPlatformRequired: boolean;
    usPresenceStrictness: 'strict_non_us' | 'allow_low_us_presence';
    minConfidenceThreshold: number;
    maxResearchCandidates: number;
    searchDepth: 'fast' | 'standard' | 'deep';
    deduplicationEnabled: boolean;
  };
  sources: {
    verifiedRegistry: boolean;
    rssFundingWires: boolean;
    openWebSearch: boolean;
    serpApi: boolean;
  };
  output: {
    defaultExportFormat: 'CSV' | 'PDF' | 'DOCX';
    includeEvidence: boolean;
    includeRejectedLeads: boolean;
    includeTimestamp: boolean;
  };
  appearance: {
    paperTexture: boolean;
    sketchDecorations: boolean;
    tableDensity: 'comfortable' | 'compact';
    animations: boolean;
  };
}

export interface SystemHealthResult {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded';
  services: Record<string, {
    status: 'connected' | 'warning' | 'error';
    latencyMs: number;
    details: string;
  }>;
}

export const REQUIRED_FIELDS = [
  'name',
  'website',
  'description',
  'industry',
  'fundingOrRevenue',
  'founderOrCeoName',
  'founderOrCeoEmail',
] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export interface HuntGeographyConfig {
  mode: 'regions' | 'countries' | 'global' | 'continents' | 'union' | 'custom';
  regions: string[];
  continents?: string[];
  countries: string[];
  excludedCountries: string[];
  usPresence?: 'strictly_none' | 'minimal_or_none' | 'limited' | 'any';
}

export interface HuntFundingConfig {
  min: number;
  max: number;
  mode: 'funding' | 'revenue' | 'funding_or_revenue' | 'funding_only' | 'revenue_only' | 'funding_and_revenue';
  targetMetric?: 'total_funding' | 'latest_round';
  preset?: string;
}

import type { TargetProfile } from './targetProfileData';
export type { TargetProfile };
export { DEFAULT_TVB_TARGET_PROFILE } from './targetProfileData';

export interface HuntConfig {
  id?: string;
  name?: string;
  geography: HuntGeographyConfig;
  sectors: string[];
  businessModels: string[];
  stage: string[];
  funding: HuntFundingConfig;
  companySize?: string[];
  techProfile: 'platform_required' | 'tech_enabled' | 'software_only' | 'ai_first' | 'any_tech';
  contactRequirement: 'ceo_only' | 'cofounder_only' | 'ceo_or_cofounder' | 'any_executive';
  emailVerification: 'required' | 'preferred' | 'none';
  depth: 'quick' | 'balanced' | 'deep' | 'exhaustive';
  targetLeads: number;
  naturalLanguageQuery?: string;
  targetProfile?: TargetProfile;
}

export interface SavedHuntPreset {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  createdAt: string;
  config: HuntConfig;
}

export const TVB_EVALUATION_CONFIG: HuntConfig = {
  id: 'tvb_eval_default',
  name: 'TVB Evaluation Profile',
  geography: {
    mode: 'global',
    regions: ['Global'],
    continents: [],
    countries: [],
    excludedCountries: [],
    usPresence: 'any',
  },
  sectors: ['all'],
  businessModels: ['Platform', 'SaaS', 'Marketplace', 'B2B', 'API'],
  stage: ['Seed', 'Series A'],
  funding: {
    min: 1_000_000,
    max: 5_000_000,
    mode: 'funding_or_revenue',
    preset: '$1M–$5M',
  },
  companySize: [],
  techProfile: 'platform_required',
  contactRequirement: 'ceo_or_cofounder',
  emailVerification: 'required',
  depth: 'balanced',
  targetLeads: 15,
};