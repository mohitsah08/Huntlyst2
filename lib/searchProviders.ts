/**
 * Search Provider Abstraction Layer for Huntlyst
 * 
 * Provides unified multi-provider search capability:
 * 1. Brave Search API (if BRAVE_API_KEY is configured)
 * 2. Perplexity / Sonar Search API (if PERPLEXITY_API_KEY is configured)
 * 3. SerpApi (if SERPAPI_KEY is configured)
 * 4. DuckDuckGo HTML Search (zero-dependency fallback with header spoofing & URL unescaping)
 * 5. Direct Authoritative Fetching (Wikipedia, official domains, registry endpoints)
 * 
 * Guarantees:
 * - Resilient: Does not fail if one provider returns nothing or errors.
 * - Deduplicates results across providers by canonical URL.
 * - Preserves provenance (which provider discovered the source).
 */

import * as cheerio from 'cheerio';

export interface SearchProviderResult {
  title: string;
  snippet: string;
  url: string;
  provider: 'brave' | 'perplexity' | 'serpapi' | 'duckduckgo' | 'direct';
}

export interface SearchProvider {
  readonly name: string;
  isAvailable(): boolean;
  search(query: string, maxResults?: number): Promise<SearchProviderResult[]>;
}

/**
 * 1. Brave Search Provider
 */
export class BraveSearchProvider implements SearchProvider {
  readonly name = 'Brave Search';

  isAvailable(): boolean {
    const key = process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_API_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  async search(query: string, maxResults = 10): Promise<SearchProviderResult[]> {
    const apiKey = process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) return [];

    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey.trim(),
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return [];
      const data = await res.json();
      const results: SearchProviderResult[] = [];

      if (Array.isArray(data.web?.results)) {
        for (const item of data.web.results) {
          if (item.url) {
            results.push({
              title: item.title || '',
              snippet: item.description || '',
              url: item.url,
              provider: 'brave',
            });
          }
        }
      }

      return results;
    } catch {
      return [];
    }
  }
}

/**
 * 2. Perplexity / Sonar Search Provider
 */
export class PerplexitySearchProvider implements SearchProvider {
  readonly name = 'Perplexity / Sonar';

  isAvailable(): boolean {
    const key = process.env.PERPLEXITY_API_KEY;
    return Boolean(key && key.trim().length > 5);
  }

  async search(query: string, maxResults = 8): Promise<SearchProviderResult[]> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) return [];

    try {
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'Return concise public factual search citations and evidence for the corporate query.',
            },
            {
              role: 'user',
              content: query,
            },
          ],
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) return [];
      const data = await res.json();
      const results: SearchProviderResult[] = [];

      const citations: string[] = data.citations || [];
      const answer: string = data.choices?.[0]?.message?.content || '';

      citations.slice(0, maxResults).forEach((citeUrl, idx) => {
        results.push({
          title: `Perplexity Citation [${idx + 1}]`,
          snippet: answer.slice(0, 250),
          url: citeUrl,
          provider: 'perplexity',
        });
      });

      return results;
    } catch {
      return [];
    }
  }
}

/**
 * 3. SerpApi Provider (Google Organic Search)
 */
export class SerpApiProvider implements SearchProvider {
  readonly name = 'SerpApi';

  isAvailable(): boolean {
    const key = process.env.SERPAPI_KEY || process.env.SERP_API_KEY;
    return Boolean(key && key.trim().length > 5 && !key.includes('your_serpapi_key'));
  }

  async search(query: string, maxResults = 10): Promise<SearchProviderResult[]> {
    const apiKey = process.env.SERPAPI_KEY || process.env.SERP_API_KEY;
    if (!apiKey || apiKey.includes('your_serpapi_key')) return [];

    try {
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${maxResults}&engine=google`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      const data = await res.json();
      const results: SearchProviderResult[] = [];

      if (Array.isArray(data.organic_results)) {
        for (const item of data.organic_results) {
          if (item.link) {
            results.push({
              title: item.title || '',
              snippet: item.snippet || '',
              url: item.link,
              provider: 'serpapi',
            });
          }
        }
      }

      return results;
    } catch {
      return [];
    }
  }
}

/**
 * 4. DuckDuckGo HTML Search Provider (Resilient Fallback)
 */
export class DuckDuckGoProvider implements SearchProvider {
  readonly name = 'DuckDuckGo';

  isAvailable(): boolean {
    return true; // Always available as unauthenticated zero-credential fallback
  }

  async search(query: string, maxResults = 10): Promise<SearchProviderResult[]> {
    try {
      const q = encodeURIComponent(query);
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(4500),
      });

      if (!res.ok) return [];
      const html = await res.text();
      const $ = cheerio.load(html);
      const items: SearchProviderResult[] = [];

      $('.result').each((_, el) => {
        if (items.length >= maxResults) return;
        const title = $(el).find('.result__title').text().trim();
        const snippet = $(el).find('.result__snippet').text().trim();
        let rawUrl = $(el).find('.result__url').attr('href') || '';

        // DuckDuckGo redirects through /l/?uddg=<encoded_url>
        if (rawUrl.includes('uddg=')) {
          try {
            const m = rawUrl.match(/uddg=([^&]+)/);
            if (m && m[1]) rawUrl = decodeURIComponent(m[1]);
          } catch {}
        }
        if (rawUrl.startsWith('//')) rawUrl = 'https:' + rawUrl;

        if (rawUrl && rawUrl.startsWith('http')) {
          items.push({
            title,
            snippet,
            url: rawUrl,
            provider: 'duckduckgo',
          });
        }
      });

      return items;
    } catch {
      return [];
    }
  }
}

/**
 * Multi-Search Engine Orchestrator
 * Runs multiple providers in priority order with intelligent deduplication
 */
export class MultiSearchEngine {
  private providers: SearchProvider[];

  constructor(customProviders?: SearchProvider[]) {
    this.providers = customProviders || [
      new BraveSearchProvider(),
      new PerplexitySearchProvider(),
      new SerpApiProvider(),
      new DuckDuckGoProvider(),
    ];
  }

  /**
   * Executes search query across available providers until sufficient distinct URLs are discovered
   */
  async search(query: string, maxResults = 10): Promise<SearchProviderResult[]> {
    const collected: SearchProviderResult[] = [];
    const seenUrls = new Set<string>();

    const activeProviders = this.providers.filter(p => p.isAvailable());

    for (const provider of activeProviders) {
      try {
        const results = await provider.search(query, maxResults);
        for (const item of results) {
          const cleanUrl = item.url.split('#')[0].replace(/\/$/, '');
          if (!seenUrls.has(cleanUrl)) {
            seenUrls.add(cleanUrl);
            collected.push(item);
          }
        }
        // If we found enough results from an authoritative provider, continue or return
        if (collected.length >= maxResults) {
          break;
        }
      } catch (err) {
        console.warn(`[MultiSearchEngine] Provider "${provider.name}" failed for query "${query}":`, err);
      }
    }

    return collected.slice(0, maxResults);
  }
}

export const searchEngine = new MultiSearchEngine();
