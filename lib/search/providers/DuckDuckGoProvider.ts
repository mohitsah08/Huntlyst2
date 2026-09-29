/**
 * DuckDuckGo Open Web Search Provider
 * 
 * Conducts web search with pagination support, user-agent headers, and timeout handling.
 */

import { ISearchProvider, SearchQueryOptions, SearchProviderResult, SearchCandidateItem } from '../types';
import { isLikelyCompanyDomain, extractCanonicalDomain } from '@/lib/deduplication';

export class DuckDuckGoProvider implements ISearchProvider {
  public readonly name = 'DuckDuckGo Open Web';

  public isConfigured(): boolean {
    return true; // Zero auth required
  }

  public async search(query: string, options: SearchQueryOptions = {}): Promise<SearchProviderResult> {
    const startMs = Date.now();
    const candidates: SearchCandidateItem[] = [];
    const timeoutMs = options.timeoutMs || 8000;
    const page = options.page || 1;

    try {
      // DuckDuckGo HTML endpoint with pagination offset
      const encodedQuery = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}&s=${(page - 1) * 30}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        return {
          providerName: this.name,
          candidates: [],
          hasMore: false,
          durationMs: Date.now() - startMs,
          error: `HTTP error ${response.status}`,
        };
      }

      const html = await response.text();
      // Match result titles, links, and snippets
      const resultBlockRegex = /<div class="result\s+results_links[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      let blockMatch;

      while ((blockMatch = resultBlockRegex.exec(html)) !== null) {
        const block = blockMatch[1];

        // Extract URL
        const linkMatch = /<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
        // Extract Title
        const titleMatch = /<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

        if (linkMatch) {
          let rawHref = linkMatch[1];
          let actualUrl = rawHref;

          if (rawHref.includes('uddg=')) {
            try {
              const urlParam = new URL(`https://duckduckgo.com${rawHref}`).searchParams.get('uddg');
              if (urlParam) actualUrl = decodeURIComponent(urlParam);
            } catch {}
          }

          if (actualUrl.startsWith('http') && !actualUrl.includes('duckduckgo.com')) {
            const canonical = extractCanonicalDomain(actualUrl);
            if (!isLikelyCompanyDomain(canonical)) {
              continue;
            }

            const rawSnippet = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
            // Extract company name from domain or snippet
            let name = canonical.split('.')[0];
            name = name.charAt(0).toUpperCase() + name.slice(1);

            candidates.push({
              name,
              url: `https://${canonical}`,
              snippet: rawSnippet || `${name} website`,
              source: this.name,
              page,
            });
          }
        }
      }

      return {
        providerName: this.name,
        candidates,
        hasMore: candidates.length >= 10,
        durationMs: Date.now() - startMs,
      };
    } catch (err: any) {
      return {
        providerName: this.name,
        candidates: [],
        hasMore: false,
        durationMs: Date.now() - startMs,
        error: err.message || 'DuckDuckGo search error',
      };
    }
  }
}

export const duckDuckGoProvider = new DuckDuckGoProvider();
