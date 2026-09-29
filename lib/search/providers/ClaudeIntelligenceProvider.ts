/**
 * Claude Intelligence Search Provider
 * 
 * Uses Anthropic Claude models with dynamic prompt variation, temperature jitter,
 * and negative domain exclusions to uncover fresh, verifiable candidate entities.
 */

import { ISearchProvider, SearchQueryOptions, SearchProviderResult, SearchCandidateItem } from '../types';
import { claudeClient } from '@/providers/claude/client';
import { extractCanonicalDomain } from '@/lib/deduplication';

export class ClaudeIntelligenceProvider implements ISearchProvider {
  public readonly name = 'Claude Venture Intelligence';

  public isConfigured(): boolean {
    return claudeClient.isConfigured();
  }

  public async search(query: string, options: SearchQueryOptions = {}): Promise<SearchProviderResult> {
    const startMs = Date.now();
    if (!this.isConfigured()) {
      return {
        providerName: this.name,
        candidates: [],
        hasMore: false,
        durationMs: 0,
        error: 'Claude API key not configured',
      };
    }

    const pageSize = options.pageSize || 10;
    const page = options.page || 1;
    const excludeDomains = options.excludeDomains || [];
    const strategyName = options.strategyName || 'Venture Search';

    // Build exclusion prompt to ensure Claude never returns previously seen companies
    const sampleExcludes = excludeDomains.slice(0, 30).map(d => extractCanonicalDomain(d)).filter(Boolean);
    const excludeDirective = sampleExcludes.length > 0
      ? `\nCRITICAL: Do NOT return any of these previously discovered companies or domains: ${sampleExcludes.join(', ')}`
      : '';

    // Vary temperature slightly based on page to ensure diversity across queries
    const temperature = Math.min(0.1 + (page * 0.08), 0.7);

    const systemPrompt = `You are Huntlyst's Venture Intelligence Discovery Agent.
Your objective is to identify REAL, VERIFIABLE startup and scale-up companies matching venture criteria.

STRICT OPERATIONAL RULES:
1. NEVER fabricate or invent company names, websites, or funding numbers.
2. Return only active, real companies with live public websites.
3. Every company must be distinct.
4. Output valid JSON array only.

Return this exact JSON format:
[
  {
    "name": string,
    "url": string,
    "snippet": string,
    "detectedCountry": string,
    "detectedIndustry": string,
    "detectedFunding": string
  }
]`;

    const userPrompt = `Search Directive [Strategy: ${strategyName} | Page: ${page}]:
Query Criteria: ${query}
Target Candidate Count: ${pageSize}
${excludeDirective}

Provide a JSON array containing up to ${pageSize} fresh, verified companies.`;

    try {
      const response = await claudeClient.createMessage(systemPrompt, userPrompt, {
        temperature,
        maxTokens: 2000,
      });

      if (!response) {
        return {
          providerName: this.name,
          candidates: [],
          hasMore: false,
          durationMs: Date.now() - startMs,
          error: 'Empty response from Claude',
        };
      }

      const cleanJson = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      const candidates: SearchCandidateItem[] = [];

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.name && item.url) {
            candidates.push({
              name: item.name,
              url: item.url.startsWith('http') ? item.url : `https://${item.url}`,
              snippet: item.snippet || `${item.name} startup entity`,
              source: this.name,
              detectedCountry: item.detectedCountry || null,
              detectedIndustry: item.detectedIndustry || null,
              detectedFunding: item.detectedFunding || null,
              page,
            });
          }
        }
      }

      return {
        providerName: this.name,
        candidates,
        hasMore: candidates.length >= pageSize,
        durationMs: Date.now() - startMs,
      };
    } catch (err: any) {
      return {
        providerName: this.name,
        candidates: [],
        hasMore: false,
        durationMs: Date.now() - startMs,
        error: err.message || 'Claude search failed',
      };
    }
  }
}

export const claudeIntelligenceProvider = new ClaudeIntelligenceProvider();
