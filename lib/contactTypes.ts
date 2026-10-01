/**
 * Contact & Decision-Maker Enrichment Types — Huntlyst2
 * 
 * Strict specifications adhering to Sections 1–22:
 * - Distinct verification states (VERIFIED, UNVERIFIED, NOT_FOUND, UNAVAILABLE, CONFLICT, UNDER_REVIEW)
 * - Company contact profile with source provenance
 * - Decision-maker discovery & verification
 * - Professional email vs explicitly public personal email
 * - Best Contact Path computation
 * - Contact Completeness independent of qualification
 * - Preservation of user-supplied input data
 * - Multiple contacts support (primary + secondary[])
 */

export type ContactVerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'CONFLICT'
  | 'UNDER_REVIEW';

export type DecisionMakerRole =
  | 'CEO'
  | 'Founder'
  | 'Co-Founder'
  | 'Executive'
  | 'Decision Maker';

export type ProfessionalEmailStatus =
  | 'VALID'
  | 'RISKY'
  | 'INVALID'
  | 'UNVERIFIED'
  | 'NOT_FOUND'
  | 'UNDER_REVIEW';

export type PersonalEmailStatus =
  | 'VALID'
  | 'UNVERIFIED'
  | 'NOT_FOUND'
  | 'NOT_DISCLOSED';

export type BestContactPathMethod =
  | 'Verified Professional Email'
  | 'Public Professional LinkedIn'
  | 'Company Email'
  | 'Company LinkedIn'
  | 'Public Personal Email'
  | 'Public X/Twitter'
  | 'Company Contact Form'
  | 'Other Public Contact'
  | 'None Available';

export interface VerifiedField<T = string> {
  value: T | null;
  verification_status: ContactVerificationStatus;
  source: string;
  source_url: string | null;
  source_type: string;
  checked_at: string;
  confidence: number; // 0-100
  original_input_value?: T | null;
  conflict_reason?: string;
}

export interface DecisionMakerContact {
  full_name: string;
  first_name: string;
  last_name: string;
  current_role: DecisionMakerRole;
  company_relationship: string;
  linkedin_url: string | null;
  linkedin_status: ContactVerificationStatus;
  twitter_x_url: string | null;
  twitter_x_status: ContactVerificationStatus;
  professional_email: string | null;
  professional_email_status: ProfessionalEmailStatus;
  professional_email_provider: string | null;
  public_personal_email: string | null; // ONLY if explicitly public on legitimate source
  public_personal_email_status: PersonalEmailStatus;
  source_url: string | null;
  source: string;
  verified_at: string;
  confidence: number; // 0-100
  verification_status: ContactVerificationStatus;
  is_primary: boolean;
  original_input?: {
    name?: string | null;
    email?: string | null;
    linkedin?: string | null;
    twitter?: string | null;
  };
}

export interface BestContactPath {
  method: BestContactPathMethod;
  explanation: string;
  value: string | null;
  target: 'decision_maker' | 'company' | 'none';
  alternative?: {
    method: BestContactPathMethod;
    explanation: string;
    value: string | null;
  } | null;
  company_fallback?: {
    method: BestContactPathMethod;
    explanation: string;
    value: string | null;
  } | null;
}

export interface ContactCompleteness {
  score: number;
  maxScore: number;
  percentage: number;
  label: string;
  details: {
    decisionMakerFound: boolean;
    professionalEmailVerified: boolean;
    publicLinkedInVerified: boolean;
    companyLinkedInVerified: boolean;
    companyEmailVerified: boolean;
    publicXAvailable: boolean;
    publicPersonalEmailStatus: 'available' | 'not_disclosed';
  };
}

export interface CompanyContactProfile {
  company_name: VerifiedField<string>;
  website: VerifiedField<string>;
  company_description: VerifiedField<string>;
  company_industry: VerifiedField<string>;
  company_city: VerifiedField<string>;
  company_country: VerifiedField<string>;
  company_linkedin: VerifiedField<string>;
  company_twitter_x: VerifiedField<string>;
  company_email: VerifiedField<string>;
  company_phone: VerifiedField<string>;
  company_contact_page: VerifiedField<string>;
  best_contact_path: BestContactPath;
  contact_completeness: ContactCompleteness;
  primary_contact: DecisionMakerContact | null;
  secondary_contacts: DecisionMakerContact[];
}

export interface ContactEnrichmentInput {
  companyName: string;
  website: string;
  description?: string | null;
  industry?: string | null;
  city?: string | null;
  country?: string | null;
  rawSnippet?: string | null;
  // User-supplied row values from input CSV/XLSX
  userInput?: {
    ceoName?: string | null;
    ceoEmail?: string | null;
    ceoEmailStatus?: string | null;
    ceoLinkedin?: string | null;
    ceoTwitter?: string | null;
    contactEmail?: string | null;
    emailStatus?: string | null;
    companyLinkedin?: string | null;
    companyTwitter?: string | null;
    phone?: string | null;
    contactPage?: string | null;
  };
}
