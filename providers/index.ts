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

export * from './types';
export { claudeProvider } from './claude';

export type ProviderType = 'claude' | 'perplexity' | 'brave';

export function getResearchProvider(providerName: ProviderType | string = 'claude'): ResearchProvider {
  switch (providerName.toLowerCase()) {
    case 'claude':
      return claudeProvider;

    case 'perplexity':
      // Perplexity provider hook for future expansion
      console.warn('[Providers] Perplexity provider requested but not yet configured. Defaulting to Claude.');
      return claudeProvider;

    case 'brave':
      // Brave search provider hook for future expansion
      console.warn('[Providers] Brave provider requested but not yet configured. Defaulting to Claude.');
      return claudeProvider;

    default:
      return claudeProvider;
  }
}
