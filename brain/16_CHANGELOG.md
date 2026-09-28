# Changelog

## 2026-09-12 — Brain Documentation Created

Created `brain/` documentation folder with 18 markdown files documenting the complete project state:

- 00_MASTER_RULES.md — Non-negotiable project rules
- 01_PRD.md — Product requirements
- 02_TRD.md — Technical requirements
- 03_ARCHITECTURE.md — Pipeline architecture
- 04_DATA_MODEL.md — TypeScript types and data flow
- 05_DATA_SOURCES.md — Discovery sources and queries
- 06_SCRAPING_SPEC.md — HTML fetching and extraction details
- 07_API_CONTRACT.md — API request/response specification
- 08_UI_SPEC.md — Frontend behavior and CSV export
- 09_ERROR_HANDLING.md — Error handling by stage with gaps
- 10_SECURITY.md — Secrets, .gitignore, rate limiting status
- 11_ADMOB_SPEC.md — Not applicable
- 12_GITHUB_ACTIONS.md — CI/CD not yet implemented
- 13_TESTING.md — No tests yet; test plan defined
- 14_PRODUCTION_CHECKLIST.md — Pre-deployment and live testing checklist
- 15_MICROTASKS.md — Running task list from code review
- 16_CHANGELOG.md — This file
- 17_DECISIONS.md — Key architectural decisions

---

## Project History (Based on Codebase)

### Initial Build (This Session)

1. **Project Scaffold**
   - `npx create-next-app@latest` equivalent created manually
   - TypeScript, App Router, Tailwind CSS configured
   - Module structure: `lib/`, `app/api/`, `app/page.tsx`

2. **Core Types** (`lib/types.ts`)
   - Defined all pipeline interfaces: `CandidateUrl`, `ExtractedCompanyData`, `ValidatedCompany`, `CompanyRecord`, `RunAgentResult`

3. **Discovery Module** (`lib/discovery.ts`)
   - `DiscoverySource` interface for extensibility
   - `SerpApiSource`: 5 rotating query phrasings via SerpAPI
   - `StartupDirectorySource`: 5 directory URLs, regex scraping
   - Domain-based deduplication

4. **Extraction Module** (`lib/extraction.ts`)
   - `fetchPageText()` with 15s timeout, proper headers
   - `extractTextFromHtml()` using Cheerio (strips scripts, styles, nav, footer, ads)
   - Anthropic Claude Sonnet 4 with strict JSON-only system prompt
   - Code fence stripping, field validation
   - Parallel extraction with concurrency limit (5)

5. **Validation Module** (`lib/validation.ts`)
   - `checkFundingRange()`: Regex parsing, $1M–$5M strict
   - `checkTechPlatform()`: 50+ keyword list
   - `checkNoUSPresence()`: Three-state (true/false/null), null = reject
   - `validateCompany()`: All checks must pass

6. **Email Module** (`lib/email.ts`)
   - 5 email pattern guesses from name + domain
   - MX record verification via `dns.promises.resolveMx()`
   - Optional Abstract API verification (graceful skip)
   - First verified email wins

7. **Ranking Module** (`lib/rank.ts`)
   - Confidence score = non-null verified fields / 8
   - Domain deduplication (keep highest confidence)
   - Sort by confidence descending
   - `MAX_DISCOVERY_ROUNDS = 3`, target = 15

8. **API Route** (`app/api/run-agent/route.ts`)
   - Orchestrates full pipeline with up to 3 rounds
   - Early exit when ≥ 15 qualified
   - Cross-round deduplication
   - Returns top 20 by confidence
   - 300s max duration, nodejs runtime

9. **Frontend** (`app/page.tsx`)
   - "Run Agent" button with loading state
   - Simulated 5-stage progress bar
   - Results table with 10 columns
   - CSV export (client-side, 11 columns)
   - Tailwind styling

10. **Documentation**
    - `README.md` with full project documentation
    - `.env.example` template
    - `brain/` folder with 18 spec files

---

## Known Issues at Creation

- Type error in route.ts (ValidatedCompanyType vs ValidatedCompany) — fixed in this session
- Missing `.gitignore`
- No test coverage
- No CI/CD
- Error handling gaps documented in 09_ERROR_HANDLING.md