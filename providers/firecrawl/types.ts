/**
 * Firecrawl v2 API Types & Schemas
 * 
 * Defines official Firecrawl v2 endpoints, request options, and response structures.
 */

export interface FirecrawlSearchOptions {
  limit?: number;
  sources?: Array<'web' | 'news' | 'images'>;
  scrapeOptions?: {
    formats?: Array<'markdown' | 'html' | 'rawHtml'>;
    onlyMainContent?: boolean;
  };
}

export interface FirecrawlSearchResultItem {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  metadata?: Record<string, any>;
}

export interface FirecrawlSearchResponse {
  success: boolean;
  data?: {
    web?: FirecrawlSearchResultItem[];
  } | FirecrawlSearchResultItem[];
  error?: string;
  warning?: string;
}

export interface FirecrawlScrapeOptions {
  formats?: Array<'markdown' | 'html' | 'rawHtml' | 'links'>;
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  headers?: Record<string, string>;
  waitFor?: number;
  timeout?: number;
}

export interface FirecrawlScrapeMetadata {
  title?: string;
  description?: string;
  language?: string;
  sourceURL?: string;
  statusCode?: number;
  error?: string;
  scrapeId?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogSiteName?: string;
  [key: string]: any;
}

export interface FirecrawlScrapedData {
  markdown?: string;
  html?: string;
  rawHtml?: string;
  links?: string[];
  metadata?: FirecrawlScrapeMetadata;
}

export interface FirecrawlScrapeResponse {
  success: boolean;
  data?: FirecrawlScrapedData;
  error?: string;
}

export interface FirecrawlAgentOptions {
  prompt: string;
  urls?: string[];
  schema?: Record<string, any>;
}

export interface FirecrawlAgentJobResponse {
  success: boolean;
  id?: string;
  threadId?: string;
  threadTurn?: number;
  error?: string;
}

export interface FirecrawlAgentPollResponse {
  success: boolean;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  data?: Record<string, any>;
  error?: string;
  citations?: Array<{ url: string; title?: string }>;
}

export interface FirecrawlCrawlOptions {
  limit?: number;
  maxDepth?: number;
  scrapeOptions?: FirecrawlScrapeOptions;
}

export interface FirecrawlCrawlResponse {
  success: boolean;
  id?: string;
  url?: string;
  data?: FirecrawlScrapedData[];
  error?: string;
}

export interface FirecrawlInteractOptions {
  prompt: string;
}

export interface FirecrawlInteractResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface FirecrawlUsageMetrics {
  searchCalls: number;
  scrapeCalls: number;
  agentCalls: number;
  crawlCalls: number;
  interactCalls: number;
  totalErrors: number;
}
