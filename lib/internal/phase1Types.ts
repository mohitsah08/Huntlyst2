/**
 * Phase 1: Internal Workflow Types
 * 
 * Strict Specification Compliance:
 * - Local-only processing in browser
 * - Preserves 100% of raw fields untouched
 * - Preserves unmapped columns
 * - Standard canonical company structure
 * - Explicit Field Availability: AVAILABLE | MISSING | INVALID | AMBIGUOUS
 * - Never hallucinates or fabricates missing factual data
 */

export type FieldAvailabilityStatus = 'AVAILABLE' | 'MISSING' | 'INVALID' | 'AMBIGUOUS';

export interface FieldAvailabilityDetail<T = any> {
  status: FieldAvailabilityStatus;
  value: T | null;
  rawValue: any;
  issues: string[];
  normalizedDisplay?: string;
}

export type CanonicalFieldKey =
  | 'companyName'
  | 'website'
  | 'canonicalDomain'
  | 'industry'
  | 'geography'
  | 'foundingYear'
  | 'companyAge'
  | 'companyStage'
  | 'totalFundingAmount'
  | 'latestFundingRoundAmount'
  | 'fundingStage';

export interface CanonicalCompanyFields {
  companyName: FieldAvailabilityDetail<string>;
  website: FieldAvailabilityDetail<string>;
  canonicalDomain: FieldAvailabilityDetail<string>;
  industry: FieldAvailabilityDetail<string>;
  geography: FieldAvailabilityDetail<string>;
  foundingYear: FieldAvailabilityDetail<number>;
  companyAge: FieldAvailabilityDetail<number>;
  companyStage: FieldAvailabilityDetail<string>;
  totalFundingAmount: FieldAvailabilityDetail<string>;
  latestFundingRoundAmount: FieldAvailabilityDetail<string>;
  fundingStage: FieldAvailabilityDetail<string>;
}

export interface Phase1CompanyRecord {
  companyId: string;
  rowIndex: number;
  rawFields: Record<string, any>;
  unmappedFields: Record<string, any>;
  canonicalFields: CanonicalCompanyFields;
  summary: {
    availableCount: number;
    missingCount: number;
    invalidCount: number;
    ambiguousCount: number;
    totalCanonicalFields: number;
    hasErrors: boolean;
    hasAmbiguities: boolean;
    readiness: 'READY' | 'ATTENTION_NEEDED' | 'INCOMPLETE';
  };
}

export interface Phase1ColumnMapping {
  sourceColumn: string;
  mappedField: CanonicalFieldKey | null;
  sampleValue?: string;
  isCustom: boolean;
}

export interface Phase1ParseError {
  rowNumber?: number;
  columnName?: string;
  message: string;
  rawSnippet?: string;
  severity: 'error' | 'warning';
}

export interface Phase1GlobalSummary {
  totalCompanies: number;
  totalAvailableFields: number;
  totalMissingFields: number;
  totalInvalidFields: number;
  totalAmbiguousFields: number;
  fieldAvailabilityPercentages: Record<CanonicalFieldKey, {
    available: number;
    missing: number;
    invalid: number;
    ambiguous: number;
  }>;
}

export interface Phase1ImportResult {
  fileName: string;
  fileType: 'CSV' | 'XLSX' | 'XLS' | 'MARKDOWN' | 'UNSUPPORTED';
  fileSizeBytes: number;
  totalRowsRead: number;
  emptyRowsSkipped: number;
  totalCompanies: number;
  detectedColumns: string[];
  columnMappings: Phase1ColumnMapping[];
  unmappedColumns: string[];
  errors: Phase1ParseError[];
  companies: Phase1CompanyRecord[];
  globalSummary: Phase1GlobalSummary;
}
