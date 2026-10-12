# TVB Huntlyst — Project Status

**Current Version**: `2.2.0`  
**Status**: `Production Ready`  
**Deployment Target**: `Vercel Production` (`huntlyst2`)  
**Runtime**: `Next.js 14.2.13 (App Router) + Node.js 20+`  
**Primary Web Data Engine**: `Firecrawl v2 API (Search, Scrape, Agent, Crawl, Interact)`  
**Agent Architecture**: `Houston Autonomous Multi-Agent Runtime`

---

## 1. Core Architecture Health

| Component | Status | Description |
| :--- | :--- | :--- |
| **Firecrawl Web Data Provider** | Operational | Primary web research provider in `providers/firecrawl/` |
| **Firecrawl Search Provider** | Operational | Candidate discovery via `/v2/search` in `SearchManager` & `MultiSearchEngine` |
| **Firecrawl Scrape & Crawl** | Operational | Clean Markdown & HTML conversion via `/v2/scrape` with Cheerio fallback |
| **Firecrawl Agent** | Operational | Autonomous structured venture data collection via `/v2/agent` |
| **Discovery Engine** | Operational | Multi-strategy search (Firecrawl, DuckDuckGo, Brave, Curated Directories) |
| **Qualification Engine** | Operational | Strict deterministic criteria checks ($1M–$5M, Non-US HQ, Tech Platform) |
| **Enrichment Engine** | Operational | Role-aware leadership (Current CEO, Former CEO, Founder, Co-Founder) |
| **Verification Engine** | Operational | Native DNS MX mail exchanger lookup, SMTP verification |
| **Internal Offline Pipeline** | Operational | 100% offline file intake & qualification with 0 network calls |
| **Target Profile Store** | Operational | Dynamic mandate persistence with canonical fallback safety |

---

## 2. Test & Quality Metrics

- **Firecrawl Provider Acceptance Tests**: 35 / 35 Passing (`tests/firecrawl-provider.test.ts`)
- **External Research Regression Tests**: 100 / 100 Scenarios Passing (`tests/regression-external-research.test.ts`)
- **Internal Qualification Regression Tests**: 38 / 38 Passing (`tests/regression-internal-qualification.test.ts`)
- **All 11 Test Suites**: 100% Passing (`npm test`)
- **TypeScript Typecheck**: 0 Errors (`npx tsc --noEmit`)
- **Production Build**: 0 Errors (`npm run build`)
- **Evidence-First Guarantee**: No synthetic emails, no fabricated LinkedIn URLs, no guessed leadership.
- **Security & Redaction**: `FIRECRAWL_API_KEY` validated server-side only, never committed, completely redacted in logs and errors.

---

## 3. Environment Configuration

```bash
# Server-side environment variable (required for live web research)
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
