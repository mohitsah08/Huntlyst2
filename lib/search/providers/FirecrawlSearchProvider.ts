/**
 * Firecrawl Web Search Provider
 * 
 * Uses Firecrawl Search API (/v2/search) to discover public web sources and candidates:
 * - High accuracy web discovery
 * - Deduplicates against excludeDomains
 * - Returns structured SearchCandidateItem entries
 */

import { ISearchProvider, SearchQueryOptions, SearchProviderResult, SearchCandidateItem } from '../types';
import { firecrawlClient } from '@/providers/firecrawl/client';
import { extractCanonicalDomain } from '@/lib/deduplication';

export class FirecrawlSearchProvider implements ISearchProvider {
  public readonly name = 'Firecrawl Web Search';

  public isConfigured(): boolean {
    return firecrawlClient.isConfigured();
  }

  public async search(query: string, options: SearchQueryOptions = {}): Promise<SearchProviderResult> {
    const startMs = Date.now();
    if (!this.isConfigured()) {
      return {
        providerName: this.name,
        candidates: [],
        hasMore: false,
        durationMs: 0,
        error: 'Firecrawl API key not configured',
      };
    }

    const pageSize = options.pageSize || 10;
    const page = options.page || 1;
    const excludeDomains = new Set((options.excludeDomains || []).map((d) => extractCanonicalDomain(d)));

    try {
      const searchRes = await firecrawlClient.search(query, {
        limit: Math.min(pageSize * 2, 20),
        sources: ['web'],
      });

      if (!searchRes.success || !searchRes.data) {
        return {
          providerName: this.name,
          candidates: [],
          hasMore: false,
          durationMs: Date.now() - startMs,
          error: searchRes.error || 'Empty response from Firecrawl search',
        };
      }

      const rawItems = Array.isArray(searchRes.data)
        ? searchRes.data
        : (searchRes.data.web || []);

      const candidates: SearchCandidateItem[] = [];

      for (const item of rawItems) {
        if (candidates.length >= pageSize) break;
        if (!item.url || !item.url.startsWith('http')) continue;

        const canonical = extractCanonicalDomain(item.url);
        if (canonical && excludeDomains.has(canonical)) continue;

        const candidateName = item.title?.split(/[-–|:]/)[0].trim() || canonical.split('.')[0];

        candidates.push({
          name: candidateName,
          url: item.url,
          snippet: item.description || item.markdown?.slice(0, 200) || `${candidateName} entity`,
          source: this.name,
          detectedCountry: options.geoTarget || null,
          page,
        });

        if (canonical) {
          excludeDomains.add(canonical);
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
        error: err.message || 'Firecrawl search failed',
      };
    }
  }
}

export const firecrawlSearchProvider = new FirecrawlSearchProvider();
