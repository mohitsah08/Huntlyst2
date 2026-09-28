/**
 * Claude Research Provider Implementation
 * 
 * Provides research, verification, and web search discovery using Anthropic Claude.
 */

import { TargetProfile } from '@/lib/targetProfileData';
import { HuntConfig } from '@/lib/types';
import {
  ResearchProvider,
  ResearchCandidateInput,
  CompanyVerificationResult,
  ProviderSearchResult,
} from '../types';
import { claudeClient } from './client';
import { researchCompanyWithClaude } from './researcher';
import { searchCandidatesWithClaude } from './searcher';

export class ClaudeResearchProvider implements ResearchProvider {
  public readonly name = 'Huntlyst Research Provider';

  public get isConfigured(): boolean {
    return claudeClient.isConfigured();
  }

  public async researchCandidate(
    candidate: ResearchCandidateInput,
    target: TargetProfile | HuntConfig
  ): Promise<CompanyVerificationResult> {
    return researchCompanyWithClaude(candidate, target);
  }

  public async searchCandidates(
    target: TargetProfile | HuntConfig,
    count: number = 10,
    excludeDomains: string[] = []
  ): Promise<ProviderSearchResult[]> {
    return searchCandidatesWithClaude(target, count, excludeDomains);
  }
}

// Singleton provider instance
export const claudeProvider = new ClaudeResearchProvider();
