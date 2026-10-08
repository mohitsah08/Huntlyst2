/**
 * Public Venture & Funding News Wires Provider
 * 
 * Fetches real-time venture investment feeds across European, Asian, and global ecosystems.
 */

import { ISearchProvider, SearchQueryOptions, SearchProviderResult, SearchCandidateItem } from '../types';

export class FundingWiresProvider implements ISearchProvider {
  public readonly name = 'Venture Funding Wires';

  private feeds = [
    'https://www.eu-startups.com/feed/',
    'https://tech.eu/feed/',
    'https://techcrunch.com/category/startups/feed/',
  ];

  public isConfigured(): boolean {
    return true;
  }

  public async search(query: string, options: SearchQueryOptions = {}): Promise<SearchProviderResult> {
    const startMs = Date.now();
    const candidates: SearchCandidateItem[] = [];
    const timeoutMs = options.timeoutMs || 6000;
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;

    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 3 && !['startup', 'funding', 'seed', 'series'].includes(k));

    for (const feedUrl of this.feeds) {
      try {
        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) continue;

        const xml = await response.text();
        const items = this.parseRssItems(xml);

        for (const item of items) {
          // If keywords provided, prioritize matches
          const text = `${item.title} ${item.description}`.toLowerCase();
          const matches = keywords.length === 0 || keywords.some(k => text.includes(k));

          if (matches) {
            candidates.push({
              name: item.extractedName || item.title.slice(0, 30),
              url: item.link,
              snippet: `${item.title}: ${item.description.slice(0, 200)}`,
              source: this.name,
              page,
            });
          }
        }
      } catch {
        // Continue on feed error
      }
    }

    const startIdx = (page - 1) * pageSize;
    const paginated = candidates.slice(startIdx, startIdx + pageSize);

    return {
      providerName: this.name,
      candidates: paginated,
      hasMore: startIdx + pageSize < candidates.length,
      totalEstimated: candidates.length,
      durationMs: Date.now() - startMs,
    };
  }

  private parseRssItems(xml: string): Array<{ title: string; link: string; description: string; extractedName?: string }> {
    const results: Array<{ title: string; link: string; description: string; extractedName?: string }> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];
      const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemContent);
      const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(itemContent);
      const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(itemContent);

      const title = titleMatch ? titleMatch[1].trim() : '';
      const link = linkMatch ? linkMatch[1].trim() : '';
      const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

      if (title && link) {
        // Try to extract company name from typical funding headlines like "Acme raises $3M..."
        const nameMatch = /^([A-Z0-9][A-Za-z0-9\s.-]{1,25})\s+(?:raises|secures|bags|closes|lands|collects)\b/i.exec(title);
        const extractedName = nameMatch ? nameMatch[1].trim() : undefined;

        results.push({
          title,
          link,
          description,
          extractedName,
        });
      }
    }

    return results;
  }
}

export const fundingWiresProvider = new FundingWiresProvider();
