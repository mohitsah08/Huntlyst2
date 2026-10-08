/**
 * Huntlyst Persistent Database & Memory Types
 * 
 * Defines the persistent schema for:
 * SearchSession, SearchTarget, SearchQuery, SearchRun, SearchResult,
 * Company, Person, Lead, Evidence, SavedLead, SearchHistory.
 */

import { TargetProfile } from '@/lib/targetProfileData';
import { HuntConfig, CompanyRecord, RejectedCompanyRecord, VerificationStatusType } from '@/lib/types';

export interface DbSearchTarget {
  rawQuery?: string;
  geography: {
    countries: string[];
    regions: string[];
    excludedCountries: string[];
    usPresenceMode: string;
  };
  funding: {
    min: number;
    max: number;
    currency: string;
    mode?: string;
  };
  industries: string[];
  subIndustries: string[];
  companyStages: string[];
  targetCount: number;
}

export interface DbSearchQuery {
  id: string;
  sessionId: string;
  strategyName: string;
  queryText: string;
  source: string;
  page: number;
  resultCount: number;
  newCount: number;
  duplicateCount: number;
  executedAt: string;
}

export interface DbSearchResult {
  id: string;
  sessionId: string;
  rawUrl: string;
  canonicalDomain: string;
  normalizedName: string;
  fingerprint: string;
  title?: string;
  snippet: string;
  source: string;
  isNew: boolean;
  discoveredAt: string;
}

export interface DbEvidence {
  id: string;
  companyDomain: string;
  field: string;
  value: string;
  sourceUrl: string;
  sourceType: string;
  snippet?: string;
  confidence: number;
  retrievedAt: string;
}

export interface DbPerson {
  id: string;
  companyDomain: string;
  name: string;
  role: string;
  email?: string | null;
  emailStatus: VerificationStatusType | 'valid' | 'invalid' | 'risky' | 'catch-all' | 'unavailable' | 'unknown';
  linkedinUrl?: string | null;
  verifiedAt?: string;
}

export interface DbCompany {
  id: string;
  canonicalDomain: string;
  normalizedName: string;
  name: string;
  website: string;
  description?: string | null;
  industry?: string | null;
  rawIndustry?: string | null;
  fundingAmount?: number | null;
  fundingText?: string | null;
  country?: string | null;
  headquarters?: string | null;
  usPresence?: boolean | null;
  confidenceScore: number;
  huntScore: number;
  qualificationStatus: 'MATCH' | 'PARTIAL MATCH' | 'UNKNOWN' | 'REJECTED';
  rejectionReasons?: string[];
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface DbSearchSession {
  id: string;
  status: 'active' | 'completed' | 'paused' | 'failed';
  target: DbSearchTarget;
  targetLeads: number;
  alreadyFoundCount: number;
  qualifiedCount: number;
  rejectedCount: number;
  previouslySeenCount: number;
  newCandidatesCount: number;
  duplicatesRemovedCount: number;
  currentQuery?: string;
  currentStrategy?: string;
  sourcesSearched: string[];
  stagnationCounter: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbSavedLead {
  id: string;
  company: CompanyRecord;
  savedAt: string;
  notes?: string;
  tags?: string[];
}

export interface DbSearchHistoryItem {
  id: string;
  sessionId: string;
  timestamp: string;
  targetSummary: string;
  targetLeads: number;
  qualifiedCount: number;
  rejectedCount: number;
  durationSeconds: number;
  status: 'Completed' | 'Degraded' | 'Failed';
  companies: CompanyRecord[];
}
