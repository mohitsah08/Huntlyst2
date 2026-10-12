/**
 * Provider Registry & Factory
 * 
 * Central switchboard for research providers.
 * Currently supports Claude as the primary provider.
 * Modular architecture allows plugging in Perplexity and Brave later
 * without rewriting the application.
 */

import { ResearchProvider } from './types';
import { claudeProvider } from './claude';
import { firecrawlProvider } from './firecrawl';

export * from './types';
export { claudeProvider } from './claude';
export { firecrawlProvider } from './firecrawl';

export type ProviderType = 'firecrawl' | 'claude' | 'perplexity' | 'brave';

export function getResearchProvider(providerName: ProviderType | string = 'firecrawl'): ResearchProvider {
  switch (providerName.toLowerCase()) {
    case 'firecrawl':
      return firecrawlProvider;

    case 'claude':
      return claudeProvider;

    case 'perplexity':
      // Perplexity provider hook for future expansion
      console.warn('[Providers] Perplexity provider requested but not yet configured. Defaulting to Firecrawl.');
      return firecrawlProvider;

    case 'brave':
      // Brave search provider hook for future expansion
      console.warn('[Providers] Brave provider requested but not yet configured. Defaulting to Firecrawl.');
      return firecrawlProvider;

    default:
      return firecrawlProvider.isConfigured ? firecrawlProvider : claudeProvider;
  }
}
