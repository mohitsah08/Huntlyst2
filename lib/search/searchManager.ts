/**
 * Search Manager & Multi-Source Dispatcher
 * 
 * Coordinates all ISearchProvider implementations:
 * - Failure isolation: if one provider errors or times out, others continue
 * - In-memory query caching to avoid repeating identical outbound network queries
 * - Provider rotation and smart multi-source fanout
 */

import { ISearchProvider, SearchQueryOptions, SearchCandidateItem, SearchProviderResult } from './types';
import { duckDuckGoProvider } from './providers/DuckDuckGoProvider';
import { claudeIntelligenceProvider } from './providers/ClaudeIntelligenceProvider';
import { serpApiProvider } from './providers/SerpApiProvider';
import { fundingWiresProvider } from './providers/FundingWiresProvider';
import { curatedVentureProvider } from './providers/CuratedVentureProvider';
import { extractCanonicalDomain } from '@/lib/deduplication';

export class SearchManager {
  private static instance: SearchManager;
  private providers: ISearchProvider[] = [];
  private cache = new Map<string, { timestamp: number; result: SearchProviderResult }>();
  private readonly CACHE_TTL_MS = 120_000; // 2 minutes

  private constructor() {
    this.providers = [
      claudeIntelligenceProvider,
      duckDuckGoProvider,
      serpApiProvider,
      curatedVentureProvider,
      fundingWiresProvider,
    ];
  }

  public static getInstance(): SearchManager {
    if (!SearchManager.instance) {
      SearchManager.instance = new SearchManager();
    }
    return SearchManager.instance;
  }

  public getAvailableProviders(): string[] {
    return this.providers.filter(p => p.isConfigured()).map(p => p.name);
  }

  /**
   * Search across all available configured providers with concurrency and failure isolation.
   */
  public async multiSourceSearch(
    query: string,
    options: SearchQueryOptions = {}
  ): Promise<{ candidates: SearchCandidateItem[]; sourcesSearched: string[]; totalDiscovered: number }> {
    const configuredProviders = this.providers.filter(p => p.isConfigured());
    const candidates: SearchCandidateItem[] = [];
    const sourcesSearched: string[] = [];
    const seenDomains = new Set((options.excludeDomains || []).map(d => extractCanonicalDomain(d)));

    const promises = configuredProviders.map(async (provider) => {
      try {
        const cacheKey = `${provider.name}::${query}::${options.page || 1}::${options.geoTarget || ''}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
          return cached.result;
        }

        const res = await provider.search(query, options);
        this.cache.set(cacheKey, { timestamp: Date.now(), result: res });
        return res;
      } catch (err: any) {
        console.warn(`[SearchManager] Provider '${provider.name}' failed:`, err.message || err);
        return {
          providerName: provider.name,
          candidates: [],
          hasMore: false,
          durationMs: 0,
          error: err.message,
        };
      }
    });

    const results = await Promise.allSettled(promises);

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.candidates.length > 0) {
        sourcesSearched.push(res.value.providerName);
        for (const cand of res.value.candidates) {
          const dom = extractCanonicalDomain(cand.url);
          if (dom && !seenDomains.has(dom)) {
            seenDomains.add(dom);
            candidates.push(cand);
          }
        }
      }
    }

    return {
      candidates,
      sourcesSearched,
      totalDiscovered: candidates.length,
    };
  }

  /**
   * Search targeting a specific named provider.
   */
  public async searchWithProvider(
    providerName: string,
    query: string,
    options: SearchQueryOptions = {}
  ): Promise<SearchProviderResult> {
    const provider = this.providers.find(p => p.name.toLowerCase().includes(providerName.toLowerCase()));
    if (!provider) {
      throw new Error(`[SearchManager] Provider '${providerName}' not found`);
    }
    return provider.search(query, options);
  }
}

export const searchManager = SearchManager.getInstance();
