/**
 * Independent Internal Workflow Settings Module
 * 
 * Strict Specification Compliance:
 * - Completely independent from universal Settings (`tvb_agent_settings`).
 * - Changing internal settings NEVER mutates or overwrites universal settings.
 * - Stored in localStorage under `huntlyst_internal_workflow_settings`.
 * - Provides full support for all 7 tabs: Target Profile, Search & Sources,
 *   Verification Rules, Field Mapping, Scoring Weights, Export & Output, Advanced.
 */

export interface InternalTargetProfile {
  fundingMin: number;
  fundingMax: number;
  /** Which funding figure the configured range applies to. */
  fundingBasis?: 'total' | 'latestRound';
  industries: string[];
  subIndustries?: string[];
  geographies?: string[];
  /** Annual revenue range in USD; null disables that range. */
  revenueMin?: number | null;
  revenueMax?: number | null;
  /** Operating duration in years; null disables that range. */
  minCompanyAge?: number | null;
  maxCompanyAge?: number | null;
  websiteRequirement?: 'Required' | 'Optional' | 'Not Required';
  /** Fields whose presence is required before a record can be VERIFIED. */
  requiredFields?: string[];
  /** Configured matching criteria that are mandatory rather than preferences. */
  mandatoryCriteria?: string[];
  stages: string[];
  executiveRequired: {
    ceo: boolean;
    cofounder: boolean;
    role: string;
  };
  emailRequirement: 'Required' | 'Optional' | 'Not Required';
  freshness: string;
  searchMode: 'offline' | 'online';
}

export interface InternalSearchSources {
  localFile: boolean;
  curatedDirectory: boolean;
  webSearch: boolean;
  fundingWires: boolean;
  firecrawlEnabled: boolean;
}

export interface InternalVerificationRules {
  strictNonUs: boolean;
  requireDnsMx: boolean;
  allowAcceptAll: boolean;
  minMatchScore: number;
  requireActiveStatus: boolean;
}

export interface InternalFieldMapping {
  companyName: string;
  website: string;
  industry: string;
  geography: string;
  founded: string;
  funding: string;
  stage: string;
  ceoName: string;
  ceoEmail: string;
}

export interface InternalScoringWeights {
  funding: number;
  industry: number;
  geography: number;
  stage: number;
  executive: number;
  email: number;
}

export interface InternalExportOutput {
  defaultFormat: 'CSV' | 'XLSX' | 'Markdown' | 'JSON';
  includeEvidence: boolean;
  includeUnverified: boolean;
  includeRawData: boolean;
  timestampInFilename: boolean;
}

export interface InternalAdvancedOptions {
  batchSize: number;
  timeoutSeconds: number;
  deduplicationEnabled: boolean;
  maxRetries: number;
}

export interface InternalWorkflowSettings {
  targetProfile: InternalTargetProfile;
  searchSources: InternalSearchSources;
  verificationRules: InternalVerificationRules;
  fieldMapping: InternalFieldMapping;
  scoringWeights: InternalScoringWeights;
  exportOutput: InternalExportOutput;
  advanced: InternalAdvancedOptions;
}

export const DEFAULT_INTERNAL_SETTINGS: InternalWorkflowSettings = {
  targetProfile: {
    fundingMin: 1_000_000,
    fundingMax: 5_000_000,
    fundingBasis: 'total',
    industries: ['Technology'],
    subIndustries: [],
    geographies: [],
    revenueMin: null,
    revenueMax: null,
    minCompanyAge: null,
    maxCompanyAge: null,
    websiteRequirement: 'Optional',
    requiredFields: ['companyName', 'domain'],
    mandatoryCriteria: ['industry', 'funding', 'stage'],
    stages: ['Seed', 'Series A', 'Series B'],
    executiveRequired: {
      ceo: true,
      cofounder: false,
      role: 'Founder',
    },
    emailRequirement: 'Required',
    freshness: '30 days',
    searchMode: 'offline',
  },
  searchSources: {
    localFile: true,
    curatedDirectory: true,
    webSearch: true,
    fundingWires: true,
    firecrawlEnabled: true,
  },
  verificationRules: {
    strictNonUs: false,
    requireDnsMx: true,
    allowAcceptAll: true,
    minMatchScore: 30,
    requireActiveStatus: true,
  },
  fieldMapping: {
    companyName: 'Name',
    website: 'URL',
    industry: 'Industry',
    geography: 'Country',
    founded: 'Founding Year',
    funding: 'Funding Amount (in USD)',
    stage: 'Funding Type',
    ceoName: 'CEO Name',
    ceoEmail: 'CEO Email',
  },
  scoringWeights: {
    funding: 25,
    industry: 20,
    geography: 20,
    stage: 15,
    executive: 10,
    email: 10,
  },
  exportOutput: {
    defaultFormat: 'CSV',
    includeEvidence: true,
    includeUnverified: true,
    includeRawData: true,
    timestampInFilename: true,
  },
  advanced: {
    batchSize: 10,
    timeoutSeconds: 30,
    deduplicationEnabled: true,
    maxRetries: 2,
  },
};

const INTERNAL_SETTINGS_STORAGE_KEY = 'huntlyst_internal_workflow_settings';

export function loadInternalSettings(): InternalWorkflowSettings {
  if (typeof window === 'undefined') return DEFAULT_INTERNAL_SETTINGS;
  try {
    const raw = localStorage.getItem(INTERNAL_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_INTERNAL_SETTINGS;
    const parsed = JSON.parse(raw);
    const savedTarget = parsed.targetProfile || {};
    const savedIndustries = Array.isArray(savedTarget.industries)
      ? savedTarget.industries.filter((industry: unknown) => String(industry).trim().toLowerCase() !== 'global')
      : DEFAULT_INTERNAL_SETTINGS.targetProfile.industries;
    return {
      targetProfile: {
        ...DEFAULT_INTERNAL_SETTINGS.targetProfile,
        ...savedTarget,
        // Online verification is intentionally not wired yet. Every new/reloaded session starts offline.
        searchMode: 'offline',
        industries: savedIndustries.length ? savedIndustries : DEFAULT_INTERNAL_SETTINGS.targetProfile.industries,
        subIndustries: Array.isArray(savedTarget.subIndustries) ? savedTarget.subIndustries : [],
        geographies: Array.isArray(savedTarget.geographies) ? savedTarget.geographies : [],
        revenueMin: savedTarget.revenueMin ?? null,
        revenueMax: savedTarget.revenueMax ?? null,
        minCompanyAge: savedTarget.minCompanyAge ?? null,
        maxCompanyAge: savedTarget.maxCompanyAge ?? null,
        websiteRequirement: savedTarget.websiteRequirement || 'Optional',
        fundingBasis: savedTarget.fundingBasis || 'total',
        requiredFields: Array.isArray(savedTarget.requiredFields) ? savedTarget.requiredFields : ['companyName', 'domain'],
        mandatoryCriteria: Array.isArray(savedTarget.mandatoryCriteria) ? savedTarget.mandatoryCriteria : ['industry', 'funding', 'stage'],
      },
      searchSources: { ...DEFAULT_INTERNAL_SETTINGS.searchSources, ...parsed.searchSources },
      verificationRules: { ...DEFAULT_INTERNAL_SETTINGS.verificationRules, ...parsed.verificationRules },
      fieldMapping: { ...DEFAULT_INTERNAL_SETTINGS.fieldMapping, ...parsed.fieldMapping },
      scoringWeights: { ...DEFAULT_INTERNAL_SETTINGS.scoringWeights, ...parsed.scoringWeights },
      exportOutput: { ...DEFAULT_INTERNAL_SETTINGS.exportOutput, ...parsed.exportOutput },
      advanced: { ...DEFAULT_INTERNAL_SETTINGS.advanced, ...parsed.advanced },
    };
  } catch {
    return DEFAULT_INTERNAL_SETTINGS;
  }
}

export function saveInternalSettings(settings: InternalWorkflowSettings): void {
  if (typeof window === 'undefined') return;
  try {
    // Persist criteria, but never persist Online as the default while online verification is unwired.
    const persisted: InternalWorkflowSettings = {
      ...settings,
      targetProfile: { ...settings.targetProfile, searchMode: 'offline' },
    };
    localStorage.setItem(INTERNAL_SETTINGS_STORAGE_KEY, JSON.stringify(persisted));
  } catch {}
}

export function resetInternalSettings(): InternalWorkflowSettings {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(INTERNAL_SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_INTERNAL_SETTINGS));
    } catch {}
  }
  return DEFAULT_INTERNAL_SETTINGS;
}
