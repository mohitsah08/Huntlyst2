/**
 * Curated Venture Directory Search Provider
 * 
 * Provides verified company candidates from the curated multi-regional tech platform
 * knowledge base, utilizing rotating cursors and negative filters to prevent repeating results.
 */

import { ISearchProvider, SearchQueryOptions, SearchProviderResult, SearchCandidateItem } from '../types';
import { VERIFIED_GLOBAL_TECH_COMPANIES } from '@/lib/discovery';
import { extractCanonicalDomain } from '@/lib/deduplication';

export class CuratedVentureProvider implements ISearchProvider {
  public readonly name = 'Curated Venture Directory';
  private cursorState = 0;

  public isConfigured(): boolean {
    return true;
  }

  public async search(query: string, options: SearchQueryOptions = {}): Promise<SearchProviderResult> {
    const startMs = Date.now();
    const pageSize = options.pageSize || 10;
    const page = options.page || 1;
    const excludeDomains = new Set((options.excludeDomains || []).map(d => extractCanonicalDomain(d)));

    const lowerQuery = query.toLowerCase();
    const candidates: SearchCandidateItem[] = [];

    // Filter matching companies based on query words (country, sector, funding)
    const matched = VERIFIED_GLOBAL_TECH_COMPANIES.filter(c => {
      const canonicalDomain = extractCanonicalDomain(c.url);
      if (excludeDomains.has(canonicalDomain)) return false;

      const fullText = `${c.name} ${c.industry} ${c.country} ${c.region} ${c.snippet}`.toLowerCase();
      // If query is broad, include; otherwise check for partial word overlap
      const words = lowerQuery.split(/\s+/).filter(w => w.length > 3 && !['startup', 'company', 'raised', 'funding'].includes(w));
      if (words.length === 0) return true;
      return words.some(w => fullText.includes(w));
    });

    // Advance start position based on page and internal rotation cursor to avoid repetition
    const offset = ((page - 1) * pageSize + this.cursorState) % Math.max(1, matched.length);
    const rotatedList = [...matched.slice(offset), ...matched.slice(0, offset)];

    for (const item of rotatedList) {
      if (candidates.length >= pageSize) break;
      const domain = extractCanonicalDomain(item.url);
      if (excludeDomains.has(domain)) continue;

      candidates.push({
        name: item.name,
        url: item.url,
        snippet: `${item.snippet} [HQ: ${item.country} | Founder: ${item.founderOrCeo} | Funding: ${item.fundingText}]`,
        source: this.name,
        detectedCountry: item.country,
        detectedIndustry: item.industry,
        detectedFunding: item.fundingText,
        page,
      });
    }

    // Update cursor for next invocation so subsequent queries receive different entities
    this.cursorState = (this.cursorState + candidates.length) % Math.max(1, VERIFIED_GLOBAL_TECH_COMPANIES.length);

    return {
      providerName: this.name,
      candidates,
      hasMore: candidates.length >= pageSize,
      totalEstimated: matched.length,
      durationMs: Date.now() - startMs,
    };
  }
}

export const curatedVentureProvider = new CuratedVentureProvider();
