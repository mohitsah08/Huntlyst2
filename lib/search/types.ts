/**
 * Search Tooling Abstraction Types
 * 
 * Provides unified interfaces for multi-source search providers:
 * ISearchProvider, SearchQueryOptions, SearchCandidateItem, SearchProviderResult
 */

export interface SearchQueryOptions {
  page?: number;
  pageSize?: number;
  cursor?: string;
  geoTarget?: string;
  timeoutMs?: number;
  excludeDomains?: string[];
  strategyName?: string;
}

export interface SearchCandidateItem {
  name: string;
  url: string;
  snippet: string;
  source: string;
  detectedCountry?: string | null;
  detectedIndustry?: string | null;
  detectedFunding?: string | null;
  page?: number;
}

export interface SearchProviderResult {
  providerName: string;
  candidates: SearchCandidateItem[];
  hasMore: boolean;
  nextCursor?: string;
  totalEstimated?: number;
  durationMs: number;
  error?: string;
}

export interface ISearchProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: string, options?: SearchQueryOptions): Promise<SearchProviderResult>;
}
