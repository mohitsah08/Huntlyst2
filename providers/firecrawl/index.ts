/**
 * Firecrawl Research Provider Implementation
 * 
 * Primary web data discovery and research provider for Huntlyst.
 * Replaces Claude-based web research with Firecrawl Search, Scrape, and Agent APIs.
 */

import { TargetProfile } from '@/lib/targetProfileData';
import { HuntConfig } from '@/lib/types';
import {
  ResearchProvider,
  ResearchCandidateInput,
  CompanyVerificationResult,
  ProviderSearchResult,
} from '../types';
import { firecrawlClient } from './client';
import { researchCompanyWithFirecrawl } from './researcher';
import { searchCandidatesWithFirecrawl } from './searcher';

export class FirecrawlResearchProvider implements ResearchProvider {
  public readonly name = 'Firecrawl Research Provider';

  public get isConfigured(): boolean {
    return firecrawlClient.isConfigured();
  }

  public async researchCandidate(
    candidate: ResearchCandidateInput,
    target: TargetProfile | HuntConfig
  ): Promise<CompanyVerificationResult> {
    return researchCompanyWithFirecrawl(candidate, target);
  }

  public async searchCandidates(
    target: TargetProfile | HuntConfig,
    count: number = 10,
    excludeDomains: string[] = []
  ): Promise<ProviderSearchResult[]> {
    return searchCandidatesWithFirecrawl(target, count, excludeDomains);
  }
}

// Singleton provider instance
export const firecrawlProvider = new FirecrawlResearchProvider();
export { firecrawlClient } from './client';
export * from './types';
