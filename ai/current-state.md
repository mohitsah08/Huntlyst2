# AI Current State — TVB Huntlyst

- **Active Engine**: Next.js 14 App Router + Houston Autonomous Agent Runtime.
- **Web Data Provider**: Firecrawl v2 API (`/v2/search`, `/v2/scrape`, `/v2/agent`, `/v2/crawl`, `/v2/scrape/:id/interact`) operating as primary provider across Search, Scrape, and Research in `providers/firecrawl/`.
- **Pipeline Architecture**: 6-Stage Deterministic Pipeline (`DISCOVER`, `RESEARCH`, `VALIDATE`, `FIND_FOUNDERS`, `VERIFY_CONTACT`, `QUALIFY`).
- **Claude Call Migration**: Replaced Claude calls for web search, web discovery, and webpage scraping with Firecrawl v2 API and deterministic normalization. Claude remains isolated as an optional reasoning fallback adapter where configured.
- **Internal Offline Guardrail**: Internal Workflow remains 100% offline with zero network calls and deterministic in-memory evaluation.
- **Verification Matrix**: All 11 test suites passing 100% (35/35 Firecrawl Acceptance tests, 100/100 External Research regression scenarios, 38/38 Internal Qualification tests). Clean TypeScript check (`tsc --noEmit`) and clean production build (`next build`).
