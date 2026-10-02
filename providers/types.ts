/**
 * Provider Architecture Types
 * 
 * Defines standard interfaces for research and search providers
 * (Claude, and future Perplexity, Brave, etc.)
 */

import { CompanyRecord, HuntConfig, RejectedCompanyRecord, CompanyContactProfile } from '@/lib/types';
import { TargetProfile } from '@/lib/targetProfileData';

export type CriterionStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'CONTRADICTED';

export type VerificationStatus = 'QUALIFIED' | 'REJECTED' | 'REVIEW' | 'UNVERIFIED' | 'PARTIALLY_VERIFIED' | 'ERROR';

export type PipelineStageName = 
  | 'DISCOVER'
  | 'RESEARCH'
  | 'VALIDATE'
  | 'FIND_FOUNDERS'
  | 'VERIFY_CONTACT'
  | 'QUALIFY';

export type StageExecutionStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'skipped';

export const STANDARD_INDUSTRY_PRESETS = [
  'General Technology',
  'SaaS Companies',
  'Agriculture',
  'Healthcare & Pharma',
  'Automotive',
  'Cybersecurity',
  'FinTech',
  'EdTech',
  'E-commerce',
  'Manufacturing',
  'Energy & CleanTech',
  'Logistics & Supply Chain',
  'Food & Agriculture',
  'Media & Entertainment',
  'Real Estate & PropTech',
  'Travel & Hospitality',
  'Telecommunications',
  'Biotechnology',
  'DeepTech',
  'AI & Machine Learning',
  'Software & IT Services',
  'Consumer Products',
  'Professional Services',
  'Other / Custom',
] as const;

export type StandardIndustryPreset = (typeof STANDARD_INDUSTRY_PRESETS)[number];

export type EnrichedFieldStatus = 'VERIFIED' | 'UNVERIFIED' | 'UNKNOWN' | 'NOT_FOUND' | 'CONTRADICTED' | 'FAIL';

export type SourceType = 
  | 'USER_INPUT' 
  | 'GOOGLE_PLACES' 
  | 'REGISTRY' 
  | 'COMPANY_WEBSITE' 
  | 'DNS' 
  | 'AUTHORITATIVE_WEB' 
  | 'NONE';

export interface EnrichedField<T = any> {
  value: T | null;
  status: EnrichedFieldStatus;
  source_url: string | null;
  source_type: SourceType;
  retrieved_at: string;
  evidence: string | null;
  confidence: number;
}

export interface CandidateSourceData {
  name: string;
  website: string | null;
  raw_industry?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  founder?: string | null;
  funding?: string | null;
  raw_fields: Record<string, any>;
}

export interface CandidateEnrichedData {
  company_name: EnrichedField<string>;
  website: EnrichedField<string>;
  raw_industry: EnrichedField<string>;
  standard_industry: EnrichedField<StandardIndustryPreset>;
  address: EnrichedField<string>;
  location: EnrichedField<string>;
  country: EnrichedField<string>;
  us_presence: EnrichedField<boolean>;
  phone: EnrichedField<string>;
  email: EnrichedField<string>;
  founder: EnrichedField<string>;
  funding: EnrichedField<string>;
  company_stage: EnrichedField<string>;
  place_id?: EnrichedField<string>;
}

export interface CandidateStageState {
  stage: PipelineStageName;
  status: StageExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string | null;
  attempts: number;
}

export interface DiscoveredPerson {
  role: 'CEO' | 'Founder' | 'Co-founder' | 'Decision Maker';
  name: string;
  title?: string;
  linkedin?: string | null;
  email?: string | null;
  emailStatus?: 'VERIFIED' | 'UNVERIFIED' | 'UNKNOWN';
  emailEvidence?: string | null;
  source?: string | null;
  evidence?: string | null;
  status: 'PASS' | 'UNKNOWN' | 'FAIL' | 'CONTRADICTED';
}

export interface CriterionResult {
  status: CriterionStatus;
  value?: string | null;
  target?: string | null;
  evidence?: string | null;
  reason?: string | null;
  source?: string | null;
  timestamp?: string;
  verificationStage?: PipelineStageName | string;
  conflict?: {
    hasConflict: boolean;
    previousValue?: string | null;
    previousSource?: string | null;
    newValue?: string | null;
    newSource?: string | null;
    description?: string;
  };
}

export interface CriterionEvaluation {
  funding: CriterionResult;
  revenue?: CriterionResult;
  industry: CriterionResult;
  sector?: CriterionResult;
  companyAge: CriterionResult;
  foundedYear?: CriterionResult;
  geography: CriterionResult;
  country?: CriterionResult;
  usPresence: CriterionResult;
  companyStage: CriterionResult;
  businessModel?: CriterionResult;
  employeeRange?: CriterionResult;
  founderOrCeo: CriterionResult;
  ceo?: CriterionResult;
  founder?: CriterionResult;
  decisionMaker?: CriterionResult;
  professionalEmail: CriterionResult;
  linkedinProfile?: CriterionResult;
}

export interface ResearchCandidateInput {
  name?: string;
  website?: string;
  url?: string;
  rawText?: string;
  source?: string;
  // Preserved original uploaded row/fields
  source_data?: CandidateSourceData;
  // Pre-existing verified evidence from previously exported Huntlyst file
  isPreviousHuntlystLead?: boolean;
  existingData?: {
    description?: string;
    industry?: string;
    sector?: string;
    fundingOrRevenue?: string;
    location?: string;
    country?: string;
    usPresence?: string;
    founderOrCeoName?: string;
    founderOrCeoEmail?: string;
    huntScore?: number;
    evidenceText?: string;
    website?: string;
  };
}

export interface CompanyVerificationResult {
  company: CompanyRecord;
  verificationStatus: VerificationStatus;
  criteria: CriterionEvaluation;
  rejectionReason?: string;
  qualificationReason?: string;
  partiallyVerifiedReason?: string;
  unverifiedReason?: string;
  decisionExplanation?: string;
  failedCriteria: string[];
  passedCriteria: string[];
  unknownCriteria: string[];
  sources: string[];
  auditTimestamp: string;
  errorMessage?: string;
  // Preserved source data & structured enriched data
  source_data?: CandidateSourceData;
  enriched_data?: CandidateEnrichedData;
  // Candidate stage states for independent progression & retry
  stages?: Record<PipelineStageName, CandidateStageState>;
  // Discovered executives/founders
  executives?: DiscoveredPerson[];
  // Conflict tracking if previous Huntlyst import
  hasConflict?: boolean;
  conflicts?: string[];
  isImportedFromHuntlyst?: boolean;
  // Contact & Decision-Maker Profile (Sections 1–22)
  contactProfile?: CompanyContactProfile;
  // Field-level independent verification audits (Seed vs Current vs Source)
  fieldAudits?: Record<string, FieldAudit>;
  divergences?: string[];
  rejectionStage?: string;
}

export interface FieldAudit<T = any> {
  field: string;
  seed_value: T | null;
  current_value: T | null;
  status: 'VERIFIED' | 'CONFLICT' | 'UNKNOWN' | 'NOT_FOUND' | 'NOT_PUBLICLY_DISCLOSED' | 'INVALID' | 'UNVERIFIED';
  source_url: string | null;
  source_type: 'COMPANY_WEBSITE' | 'AUTHORITATIVE_WEB' | 'REGISTRY' | 'DNS' | 'USER_INPUT' | 'NONE';
  checked_at: string;
  evidence: string;
  confidence_reason: string;
}


export interface ProviderSearchResult {
  name: string;
  url: string;
  snippet: string;
  source: string;
  detectedCountry?: string;
  detectedIndustry?: string;
}

export interface ResearchProvider {
  readonly name: string;
  readonly isConfigured: boolean;

  /**
   * Researches and verifies an individual company candidate against the target profile.
   * Zero hallucination: unverified fields must be marked UNKNOWN.
   */
  researchCandidate(
    candidate: ResearchCandidateInput,
    target: TargetProfile | HuntConfig
  ): Promise<CompanyVerificationResult>;

  /**
   * Discovers candidate companies via provider search based on target profile.
   */
  searchCandidates(
    target: TargetProfile | HuntConfig,
    count: number,
    excludeDomains?: string[]
  ): Promise<ProviderSearchResult[]>;
}
