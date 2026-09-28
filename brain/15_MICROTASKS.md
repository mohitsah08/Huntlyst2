# Microtasks

Running list of small remaining tasks/bugs pulled from actual code state.

## Code Issues

- [ ] **Fix type error in route.ts line 55**: `ValidatedCompanyType` not defined — should be `ValidatedCompany` from types
- [ ] **Add try/catch to `extractTextFromHtml`** (lib/extraction.ts:79) — Cheerio load can throw on malformed HTML
- [ ] **Wrap worker in `extractAllCandidates`** (lib/extraction.ts:186) with try/catch — one bad candidate shouldn't crash all workers
- [ ] **Add try/catch around main pipeline loop** (route.ts:148) — unhandled exception crashes entire run
- [ ] **Validate input to `buildCompanyRecord`** (lib/rank.ts:61) — assumes valid `ValidatedCompany`

## Missing Features

- [ ] **Add `.gitignore`** with standard Node/Next.js entries
- [ ] **Add request deduplication** in extraction — same URL may be fetched multiple times across rounds
- [ ] **Add retry logic** with exponential backoff for:
  - [ ] SerpAPI requests
  - [ ] Page fetches
  - [ ] Anthropic API calls
- [ ] **Add robots.txt compliance** check before scraping
- [ ] **Real-time progress** via Server-Sent Events or WebSocket (currently simulated)
- [ ] **Rate limiting** on `/api/run-agent` endpoint
- [ ] **Authentication** for API endpoint

## Data Quality Improvements

- [ ] **Add more SerpAPI query variations** for better geographic coverage
- [ ] **Replace directory scraping** with official APIs (Crunchbase, AngelList)
- [ ] **Add regional search sources** (local startup databases per country)
- [ ] **Improve `checkTechPlatform` keywords** based on false positive/negative analysis
- [ ] **Improve `checkNoUSPresence` keywords** based on false positive/negative analysis

## Testing

- [ ] Add unit tests for validation functions (highest priority)
- [ ] Add unit tests for email functions
- [ ] Add unit tests for ranking functions
- [ ] Add integration tests with mocked external APIs
- [ ] Add E2E test for full pipeline

## Documentation

- [ ] Create `.env.example` with all required variables (DONE)
- [ ] Add JSDoc comments to all public functions
- [ ] Document deployment process for target platform

## Dependency Updates

- [ ] Update Next.js from 14.2.13 to patched version (security vulnerability)
- [ ] Run `npm audit fix --force` after Next.js update