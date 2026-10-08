/**
 * SerpAPI Google Search Provider
 * 
 * Provides search via Google organic results using SerpAPI with
 * location geotargeting, pagination offsets, and safe error handling.
 */

import { ISearchProvider, SearchQueryOptions, SearchProviderResult, SearchCandidateItem } from '../types';

export class SerpApiProvider implements ISearchProvider {
  public readonly name = 'Google Search (SerpAPI)';

  public isConfigured(): boolean {
    const key = process.env.SERPAPI_KEY;
    return Boolean(key && key !== 'your_serpapi_key_here' && key.trim().length > 10);
  }

  public async search(query: string, options: SearchQueryOptions = {}): Promise<SearchProviderResult> {
    const startMs = Date.now();
    if (!this.isConfigured()) {
      return {
        providerName: this.name,
        candidates: [],
        hasMore: false,
        durationMs: 0,
        error: 'SerpAPI key not configured',
      };
    }

    const apiKey = process.env.SERPAPI_KEY!;
    const pageSize = options.pageSize || 10;
    const page = options.page || 1;
    const startOffset = (page - 1) * pageSize;
    const geoTarget = options.geoTarget || 'uk';
    const timeoutMs = options.timeoutMs || 10000;

    try {
      const params = new URLSearchParams({
        q: query,
        api_key: apiKey,
        engine: 'google',
        num: String(pageSize),
        start: String(startOffset),
        gl: geoTarget,
        hl: 'en',
      });

      const response = await fetch(`https://serpapi.com/search?${params.toString()}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        return {
          providerName: this.name,
          candidates: [],
          hasMore: false,
          durationMs: Date.now() - startMs,
          error: `SerpAPI HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      const organic = data.organic_results || [];
      const candidates: SearchCandidateItem[] = [];

      for (const res of organic) {
        if (res.link) {
          const rawTitle = res.title || '';
          let name = rawTitle.split(/[-|–:]/)[0].trim();
          if (!name || name.length > 40) {
            name = res.link.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].split('.')[0];
            name = name.charAt(0).toUpperCase() + name.slice(1);
          }

          candidates.push({
            name,
            url: res.link,
            snippet: res.snippet || rawTitle,
            source: this.name,
            page,
          });
        }
      }

      return {
        providerName: this.name,
        candidates,
        hasMore: organic.length >= pageSize,
        totalEstimated: data.search_information?.total_results,
        durationMs: Date.now() - startMs,
      };
    } catch (err: any) {
      return {
        providerName: this.name,
        candidates: [],
        hasMore: false,
        durationMs: Date.now() - startMs,
        error: err.message || 'SerpAPI search failed',
      };
    }
  }
}

export const serpApiProvider = new SerpApiProvider();
