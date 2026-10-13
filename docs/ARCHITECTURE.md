# System Architecture — TVB Huntlyst

## 1. High-Level System Design

```
┌────────────────────────────────────────────────────────┐
│               Huntlyst Next.js 14 App                  │
│       Client Desk UI  •  SSE Streaming  •  Cards       │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────▼──────────────┐
             │    API Orchestration Layer │
             │  /api/run-agent  /api/lead │
             └─────────────┬──────────────┘
                           │
             ┌─────────────▼──────────────┐
             │ Houston Agent Runtime      │
             │ Workspaces & Skills Mesh   │
             └─────────────┬──────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ External Research Engine     │ │ Internal Offline Pipeline    │
│ • Firecrawl Web Data Provider│ │ • Multi-format File Parsing  │
│ • Firecrawl Search (/search) │ │ • Lead Normalization         │
│ • Firecrawl Scrape (/scrape) │ │ • Offline Deterministic Rule │
│ • Firecrawl Agent (/agent)   │ │ • Zero Web Fetch Safeguards  │
│ • Cheerio/Direct Fallback    │ │ • Pure In-Memory Matching    │
│ • Live DNS MX Verification   │ │                              │
└──────────────────────────────┘ └──────────────────────────────┘
```

## 2. Web Research Architecture: Before vs After Migration

### Before Migration
- **Discovery**: Relied heavily on Claude (`claudeClient.search()`) and third-party APIs with prompt-engineered web queries.
- **Scraping**: Limited Cheerio HTML fetching with frequent anti-bot blocks on dynamic JavaScript sites.
- **Fact Extraction**: Claude prompt evaluations making raw LLM inferences susceptible to hallucinations.
- **Provider Layer**: No unified abstraction for modern web scraping providers.

### After Migration (Firecrawl v2 Engine)
- **Primary Provider**: Official Firecrawl v2 API (`https://api.firecrawl.dev/v2`) encapsulated in `providers/firecrawl/`.
- **Search & Discovery**: High-fidelity web queries via Firecrawl Search API (`/v2/search`) prioritizing primary corporate sources.
- **Web Scraping**: Clean Markdown & HTML conversion via Firecrawl Scrape API (`/v2/scrape`) with dynamic rendering, bypassing JS shields.
- **Autonomous Agent Research**: Firecrawl Agent API (`/v2/agent`) for structured fact collection with asynchronous job polling.
- **Deep Site Crawling**: Firecrawl Crawl API (`/v2/crawl`) for multi-page company analysis.
- **Browser Interaction**: Firecrawl Interact API (`/v2/scrape/:id/interact`) for dynamic pagination/navigation.
- **Deterministic Evaluation**: Replaced unstructured LLM fact extraction with typed schemas, regex validators, standard industry taxonomies (`lib/discoveryPipeline.ts`), and live DNS MX resolution (`lib/email.ts`).
- **Internal Offline Guardrail**: Internal Workflow remains 100% offline with zero network calls and strict in-memory execution.

## 3. Core Modules

- **`providers/firecrawl/client.ts`**: Firecrawl v2 HTTP client with exponential backoff on 429/5xx, timeout handling, error redaction, custom fetch injection for hermetic unit testing, and credit usage tracking.
- **`providers/firecrawl/searcher.ts`**: Multi-strategy candidate discovery utilizing `QueryPlanner` + Firecrawl Search API + domain deduplication.
- **`providers/firecrawl/researcher.ts`**: Comprehensive corporate research orchestration using Firecrawl Scrape, targeted search, DNS MX email checks, and TargetProfile criteria validation.
- **`providers/firecrawl/index.ts`**: `ResearchProvider` singleton registered and defaulted in `providers/index.ts`.
- **`lib/search/providers/FirecrawlSearchProvider.ts`**: `ISearchProvider` implementation plugged into `SearchManager` as top priority.
- **`lib/sourceInspection.ts`**: Source inspection manager using Firecrawl Scrape when configured with resilient Cheerio fallback.
- **`lib/extraction.ts`**: Web content extractor with Firecrawl Scrape integration.
- **`lib/founderDiscovery.ts` & `lib/contactEnrichment.ts`**: Executive discovery pipelines with Firecrawl search discovery prioritized before LLM fallback.
- **`lib/internalQualification.ts`**: Strict offline deterministic lead evaluation.

## 4. Environment Configuration

- **`FIRECRAWL_API_KEY`**: Server-side API key for Firecrawl. Required in `.env.local` / production environment variables. Never exposed to browser or logs.

## 5. Rollback Steps

If Firecrawl service is unavailable:
1. Set `RESEARCH_PROVIDER=claude` in `.env.local` or environment variables to switch back to Claude evaluator.
2. In `providers/index.ts`, change `defaultProvider = 'firecrawl'` back to `defaultProvider = 'claude'`.
3. Cheerio direct HTML fetching automatically acts as secondary fallback when Firecrawl API is unconfigured or rate-limited.
