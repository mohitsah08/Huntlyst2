/**
 * Firecrawl HTTP Client
 * 
 * Encapsulates Firecrawl v2 API interactions:
 * - Secure credential validation (server-side only via FIRECRAWL_API_KEY)
 * - Zero secret leakage: API keys are strictly redacted in error reports and logs
 * - Bounded retries with exponential backoff for 429 rate limits and 5xx errors
 * - Strict request timeouts and AbortController cancellation
 * - Real provider usage and metric accounting
 */

import {
  FirecrawlSearchOptions,
  FirecrawlSearchResponse,
  FirecrawlSearchResultItem,
  FirecrawlScrapeOptions,
  FirecrawlScrapeResponse,
  FirecrawlAgentOptions,
  FirecrawlAgentJobResponse,
  FirecrawlAgentPollResponse,
  FirecrawlCrawlOptions,
  FirecrawlCrawlResponse,
  FirecrawlInteractResponse,
  FirecrawlUsageMetrics,
} from './types';

export class FirecrawlClient {
  private static instance: FirecrawlClient;
  private readonly baseUrl: string;
  private usage: FirecrawlUsageMetrics = {
    searchCalls: 0,
    scrapeCalls: 0,
    agentCalls: 0,
    crawlCalls: 0,
    interactCalls: 0,
    totalErrors: 0,
  };

  // Optional custom fetch handler for testing & deterministic mocks
  private customFetch?: typeof fetch;

  public constructor(baseUrl: string = 'https://api.firecrawl.dev/v2') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public static getInstance(): FirecrawlClient {
    if (!FirecrawlClient.instance) {
      FirecrawlClient.instance = new FirecrawlClient();
    }
    return FirecrawlClient.instance;
  }

  public setCustomFetch(customFetch?: typeof fetch): void {
    this.customFetch = customFetch;
  }

  public getUsageMetrics(): Readonly<FirecrawlUsageMetrics> {
    return { ...this.usage };
  }

  public resetUsageMetrics(): void {
    this.usage = {
      searchCalls: 0,
      scrapeCalls: 0,
      agentCalls: 0,
      crawlCalls: 0,
      interactCalls: 0,
      totalErrors: 0,
    };
  }

  /**
   * Validates whether FIRECRAWL_API_KEY is configured and valid
   */
  public isConfigured(): boolean {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) return false;
    const trimmed = key.trim();
    if (trimmed.length < 10) return false;
    if (trimmed.includes('your_') || trimmed.includes('placeholder')) return false;
    return true;
  }

  /**
   * Safely retrieves the API key or throws a sanitized error without revealing secrets
   */
  private getApiKey(): string {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key || !this.isConfigured()) {
      throw new Error('[FirecrawlClient] FIRECRAWL_API_KEY is missing or invalid. Please configure FIRECRAWL_API_KEY in server environment.');
    }
    return key.trim();
  }

  /**
   * Redacts any potential API key or sensitive token from an error message
   */
  private sanitizeErrorMessage(message: string): string {
    return message
      .replace(/fc-[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]')
      .replace(/Bearer\s+[a-zA-Z0-9_.-]+/gi, 'Bearer [REDACTED]')
      .replace(/key=[a-zA-Z0-9_.-]+/gi, 'key=[REDACTED]');
  }

  /**
   * Core request executor with bounded retry and timeout
   */
  private async executeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST',
    body?: Record<string, any>,
    timeoutMs: number = 20000,
    maxRetries: number = 2
  ): Promise<T> {
    const apiKey = this.getApiKey();
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const fetchFn = this.customFetch || fetch;

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const headers: Record<string, string> = {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        };
        if (body && method === 'POST') {
          headers['Content-Type'] = 'application/json';
        }

        const res = await fetchFn(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.status === 429) {
          // Rate limit encountered
          attempt++;
          if (attempt <= maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            console.warn(`[FirecrawlClient] Rate limit 429 hit. Retrying in ${Math.round(backoffMs)}ms (attempt ${attempt}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          throw new Error('[FirecrawlClient] Rate limit exceeded (HTTP 429). Provider quota or rate threshold reached.');
        }

        if (res.status >= 500) {
          attempt++;
          if (attempt <= maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            console.warn(`[FirecrawlClient] Server error ${res.status}. Retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
        }

        if (!res.ok) {
          let errorDetail = `HTTP ${res.status} ${res.statusText}`;
          try {
            const errorJson = await res.json();
            if (errorJson?.error) {
              errorDetail = errorJson.error;
            } else if (errorJson?.message) {
              errorDetail = errorJson.message;
            }
          } catch {
            // ignore JSON parse error on non-ok responses
          }
          throw new Error(`[FirecrawlClient] Request failed (${res.status}): ${this.sanitizeErrorMessage(errorDetail)}`);
        }

        const data = await res.json();
        return data as T;
      } catch (err: any) {
        lastError = err;
        if (err.name === 'AbortError') {
          throw new Error(`[FirecrawlClient] Request to ${endpoint} timed out after ${timeoutMs}ms.`);
        }
        if (attempt >= maxRetries) {
          break;
        }
        attempt++;
      }
    }

    this.usage.totalErrors++;
    const safeMsg = this.sanitizeErrorMessage(lastError?.message || 'Unknown network error');
    throw new Error(safeMsg);
  }

  /**
   * Search for public web sources using Firecrawl Search API (/v2/search)
   */
  public async search(
    query: string,
    options: FirecrawlSearchOptions = {}
  ): Promise<FirecrawlSearchResponse> {
    this.usage.searchCalls++;
    const payload = {
      query,
      limit: options.limit || 5,
      sources: options.sources || ['web'],
      ...(options.scrapeOptions ? { scrapeOptions: options.scrapeOptions } : {}),
    };

    try {
      const res = await this.executeRequest<FirecrawlSearchResponse>(
        '/search',
        'POST',
        payload,
        15000
      );
      return res;
    } catch (err: any) {
      this.usage.totalErrors++;
      return {
        success: false,
        error: this.sanitizeErrorMessage(err.message || 'Firecrawl search failed'),
      };
    }
  }

  /**
   * Scrape clean web page markdown and metadata using Firecrawl Scrape API (/v2/scrape)
   */
  public async scrape(
    url: string,
    options: FirecrawlScrapeOptions = {}
  ): Promise<FirecrawlScrapeResponse> {
    this.usage.scrapeCalls++;
    const payload = {
      url,
      formats: options.formats || ['markdown', 'html'],
      onlyMainContent: options.onlyMainContent ?? true,
      ...(options.waitFor ? { waitFor: options.waitFor } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
    };

    const timeoutMs = options.timeout || 25000;

    try {
      const res = await this.executeRequest<FirecrawlScrapeResponse>(
        '/scrape',
        'POST',
        payload,
        timeoutMs
      );
      return res;
    } catch (err: any) {
      this.usage.totalErrors++;
      return {
        success: false,
        error: this.sanitizeErrorMessage(err.message || 'Firecrawl scrape failed'),
      };
    }
  }

  /**
   * Execute an autonomous research query using Firecrawl Agent API (/v2/agent)
   * Handles asynchronous job submission and polling with a maximum wait time.
   */
  public async runAgent(
    prompt: string,
    options: { urls?: string[]; maxWaitMs?: number; pollIntervalMs?: number } = {}
  ): Promise<FirecrawlAgentPollResponse> {
    this.usage.agentCalls++;
    const maxWaitMs = options.maxWaitMs || 45000;
    const pollIntervalMs = options.pollIntervalMs || 3000;

    const payload: FirecrawlAgentOptions = {
      prompt,
      ...(options.urls ? { urls: options.urls } : {}),
    };

    try {
      const submitRes = await this.executeRequest<FirecrawlAgentJobResponse>(
        '/agent',
        'POST',
        payload,
        15000
      );

      if (!submitRes.success || !submitRes.id) {
        return {
          success: false,
          error: submitRes.error || 'Failed to initialize Firecrawl agent task',
        };
      }

      const jobId = submitRes.id;
      const startTime = Date.now();

      // Poll until completed or timeout
      while (Date.now() - startTime < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        try {
          const pollRes = await this.executeRequest<FirecrawlAgentPollResponse>(
            `/agent/${jobId}`,
            'GET',
            undefined,
            10000
          );

          if (pollRes.status === 'completed') {
            return pollRes;
          }

          if (pollRes.status === 'failed') {
            return {
              success: false,
              status: 'failed',
              error: pollRes.error || 'Firecrawl agent run failed on server',
            };
          }
        } catch (pollErr: any) {
          console.warn(`[FirecrawlClient] Agent poll error for job ${jobId}: ${pollErr.message}`);
        }
      }

      return {
        success: false,
        error: `Firecrawl agent exceeded maximum polling duration (${maxWaitMs}ms)`,
      };
    } catch (err: any) {
      this.usage.totalErrors++;
      return {
        success: false,
        error: this.sanitizeErrorMessage(err.message || 'Firecrawl agent call failed'),
      };
    }
  }

  /**
   * Initiate a targeted multi-page Crawl on a company website (/v2/crawl)
   */
  public async crawl(
    url: string,
    options: FirecrawlCrawlOptions = {}
  ): Promise<FirecrawlCrawlResponse> {
    this.usage.crawlCalls++;
    const payload = {
      url,
      limit: options.limit || 5,
      maxDepth: options.maxDepth || 2,
      scrapeOptions: options.scrapeOptions || { formats: ['markdown'] },
    };

    try {
      const res = await this.executeRequest<FirecrawlCrawlResponse>(
        '/crawl',
        'POST',
        payload,
        30000
      );
      return res;
    } catch (err: any) {
      this.usage.totalErrors++;
      return {
        success: false,
        error: this.sanitizeErrorMessage(err.message || 'Firecrawl crawl failed'),
      };
    }
  }

  /**
   * Perform interactive browser actions on a scraped page (/v2/scrape/{scrapeId}/interact)
   */
  public async interact(
    scrapeId: string,
    prompt: string
  ): Promise<FirecrawlInteractResponse> {
    this.usage.interactCalls++;
    const payload = { prompt };

    try {
      const res = await this.executeRequest<FirecrawlInteractResponse>(
        `/scrape/${scrapeId}/interact`,
        'POST',
        payload,
        20000
      );
      return res;
    } catch (err: any) {
      this.usage.totalErrors++;
      return {
        success: false,
        error: this.sanitizeErrorMessage(err.message || 'Firecrawl interaction failed'),
      };
    }
  }
}

export const firecrawlClient = FirecrawlClient.getInstance();
