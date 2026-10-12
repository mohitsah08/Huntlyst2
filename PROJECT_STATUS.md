# TVB Huntlyst — Project Status

**Current Version**: `2.3.0`  
**Status**: `Production Ready`  
**Deployment Target**: `Vercel Production` (`huntlyst2`)  
**Runtime**: `Next.js 14.2.13 (App Router) + Node.js 20+`  
**Primary Web Data Engine**: `Firecrawl v2 API (Search, Scrape, Crawl)`  
**Workflow Model**: `Independent Dual-Workflow Architecture (Research/Scrape & Target-Based Verification)`

---

## 1. Core Architecture Health

| Component | Status | Description |
| :--- | :--- | :--- |
| **Workflow A: Company Research & Scrape** | Operational | Firecrawl-powered scraping of official domains, subpages, and authoritative sources into persistent `CompanyResearchProfile` |
| **Workflow B: Target Criteria Store** | Operational | Independent target criteria management (`/api/target-profile`) with zero side effects on scraped company data |
| **Workflow C: Explicit Verification Engine** | Operational | Deterministic criteria evaluation (`/api/verify`) with PASS / FAIL / UNKNOWN status; zero re-scraping on criteria re-evaluation |
| **Evidence Explorer & Provenance** | Operational | Field-level citations, direct source URLs, and quote excerpts for every extracted attribute |
| **Input Validation & Anti-Hallucination** | Operational | Rejection of prompts/instructions; strict zero-guessing for synthetic domains and unverified emails |
| **Firecrawl Web Data Provider** | Operational | Primary web research provider in `providers/firecrawl/` & `lib/research/pipeline.ts` |
| **Internal Offline Pipeline** | Operational | 100% offline file intake & qualification with 0 network calls |
| **Export & Unified Store Integration** | Operational | Full CSV, XLSX, and PDF exports synchronized with `UnifiedLeadStore` |

---

## 2. Test & Quality Metrics

- **Independent Workflows Regression Suite**: 38 / 38 Passing (`tests/external-independent-workflows.test.ts`)
- **Firecrawl Provider Acceptance Tests**: 35 / 35 Passing (`tests/firecrawl-provider.test.ts`)
- **External Research Regression Tests**: 100 / 100 Scenarios Passing (`tests/regression-external-research.test.ts`)
- **Internal Qualification Regression Tests**: 38 / 38 Passing (`tests/regression-internal-qualification.test.ts`)
- **Contact Enrichment Tests**: 78 / 78 Passing
- **TypeScript Typecheck**: 0 Errors (`npx tsc --noEmit`)
- **Production Build**: 0 Errors (`npm run build`)
- **Evidence-First Guarantee**: No synthetic emails, no fabricated domains, no default planner hints stored as facts.
- **Security & Redaction**: `FIRECRAWL_API_KEY` server-side only, completely redacted in logs and errors.

---

## 3. Environment Configuration

```bash
# Server-side environment variable (required for live web research)
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

