/**
 * Lead Package & Unified Lead Data Structures
 * 
 * Strict Specification Compliance:
 * 1. Agent 1 creates ONE structured Lead Package for EACH input lead.
 * 2. Preserves every original uploaded field in raw_fields untouched.
 * 3. Normalizes fields separately into normalized fields.
 * 4. Audits: fields_present, fields_missing, placeholders, malformed_fields, duplicate_signals.
 * 5. Exactly FOUR final user-facing statuses: VERIFIED | REVIEW | UNVERIFIED | REJECTED.
 * 6. One canonical unified lead model merging INTERNAL and EXTERNAL.
 */

export type FinalLeadStatus = 'VERIFIED' | 'REVIEW' | 'UNVERIFIED' | 'REJECTED';
export type WorkflowOrigin = 'INTERNAL' | 'EXTERNAL';
export type CombinedOrigin = 'INTERNAL' | 'EXTERNAL' | 'BOTH';

export interface PlaceholderDetail {
  field: string;
  rawValue: string;
  detectedAs: string;
}

export interface MalformedFieldDetail {
  field: string;
  rawValue: string;
  reason: string;
}

export interface LeadPackageSource {
  file_name: string;
  file_type: string;
  row_number: number;
  sheet_name?: string | null;
  page_number?: number | null;
}

export interface LeadPackageNormalized {
  company_name: string;
  website: string | null;
  canonical_domain?: string | null;
  country: string | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
  industry: string | null;
  sub_industry?: string | null;
  description?: string | null;
  funding: string | null;
  funding_amount_usd?: number | null;
  funding_date?: string | null;
  funding_type?: string | null;
  founder_or_ceo: string | null;
  company_email: string | null;
  ceo_email?: string | null;
  company_linkedin: string | null;
  ceo_linkedin: string | null;
  company_twitter?: string | null;
  ceo_twitter?: string | null;
  employee_count?: string | null;
  founded_year?: string | null;
}

export interface LeadPackageAudit {
  fields_present: string[];
  fields_missing: string[];
  placeholders: PlaceholderDetail[];
  malformed_fields: MalformedFieldDetail[];
  duplicate_signals: string[];
}

export interface LeadPackage {
  candidate_id: string;
  source: LeadPackageSource;
  seed_data: {
    raw_fields: Record<string, any>;
    normalized: LeadPackageNormalized;
  };
  audit: LeadPackageAudit;
}

export interface StatusHistoryEntry {
  status: FinalLeadStatus;
  source: 'INTERNAL_AUTO' | 'EXTERNAL_AUTO' | 'MANUAL_OVERRIDE' | 'SYSTEM';
  timestamp: string;
  override_by?: string;
  reason: string;
  previous_status?: FinalLeadStatus;
}

export interface ManualOverrideRecord {
  lead_id: string;
  workflow: WorkflowOrigin;
  original_status: FinalLeadStatus;
  new_status: FinalLeadStatus;
  manual_override: true;
  override_by: string;
  override_at: string;
  override_reason: string;
  previous_status_history_id?: string;
  source: 'USER_ACTION';
}

export interface LeadQualificationSummary {
  target_profile_id?: string;
  match_percentage: string;
  match_score: number;
  criteria: Record<string, {
    name: string;
    category: string;
    active: boolean;
    status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'CONTRADICTED' | 'DISABLED' | 'INFORMATIONAL';
    requiredValue?: string;
    actualValue?: string;
    reason: string;
    evidence?: string;
    weight: number;
  }>;
  passedCriteria: string[];
  failedCriteria: string[];
  missingCriteria: string[];
  reviewCriteria: string[];
  exactReason?: string;
}

export interface UnifiedLeadInternalSnapshot {
  source_file: string;
  source_row: number;
  sheet_name?: string | null;
  page_number?: number | null;
  raw_data: Record<string, any>;
  normalized_data: LeadPackageNormalized;
  audit: LeadPackageAudit;
  lead_package?: LeadPackage;
  status: FinalLeadStatus;
  status_history: StatusHistoryEntry[];
  evaluated_at: string;
}

export interface UnifiedLeadExternalSnapshot {
  researched: boolean;
  current_data: Record<string, any>;
  evidence: Record<string, any>;
  status: FinalLeadStatus;
  status_history: StatusHistoryEntry[];
  researched_at: string;
  sources?: string[];
}

export interface UnifiedLead {
  id: string; // canonical_lead_id
  identity: {
    company_name: string;
    canonical_domain: string;
    website: string;
  };
  origins: WorkflowOrigin[];
  originDisplay: CombinedOrigin;
  internal?: UnifiedLeadInternalSnapshot;
  external?: UnifiedLeadExternalSnapshot;
  currentStatus: FinalLeadStatus;
  qualification: LeadQualificationSummary;
  auditTrail: ManualOverrideRecord[];
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string;
}

// Helper to determine origin display
export function computeOriginDisplay(origins: WorkflowOrigin[]): CombinedOrigin {
  const hasInt = origins.includes('INTERNAL');
  const hasExt = origins.includes('EXTERNAL');
  if (hasInt && hasExt) return 'BOTH';
  if (hasExt) return 'EXTERNAL';
  return 'INTERNAL';
}

// Known placeholder patterns
export const PLACEHOLDER_PATTERNS = [
  /^upgrade\s*to\s*unlock$/i,
  /^locked$/i,
  /^hidden$/i,
  /^n\/?a$/i,
  /^na$/i,
  /^none$/i,
  /^null$/i,
  /^undefined$/i,
  /^-+$/,
  /^\?+$/,
  /^unknown$/i,
  /^not\s*disclosed$/i,
  /^paywalled$/i,
];

export function isPlaceholderValue(val: any): boolean {
  if (val === undefined || val === null) return true;
  const str = String(val).trim();
  if (!str) return true;
  return PLACEHOLDER_PATTERNS.some(p => p.test(str));
}
