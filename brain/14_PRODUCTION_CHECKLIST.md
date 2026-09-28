# Production Checklist

## Pre-Deployment

- [ ] **Environment variables set** in deployment platform:
  - [ ] `SERPAPI_KEY` (valid, sufficient quota)
  - [ ] `ANTHROPIC_API_KEY` (valid, sufficient quota)
  - [ ] `ABSTRACT_API_KEY` (optional, but recommended for email quality)

- [ ] **Build passes** locally:
  - [ ] `npm install` succeeds
  - [ ] `npm run build` succeeds (no TypeScript errors)
  - [ ] `npm run lint` passes

- [ ] **No hardcoded secrets** anywhere in codebase
  - [ ] Grep for API keys in source files → none found
  - [ ] `.env.local` not committed (add to `.gitignore`)

- [ ] **README.md complete** with:
  - [ ] Project description
  - [ ] Architecture overview
  - [ ] Required env vars and where to get them
  - [ ] Run instructions (`npm install && npm run dev`)
  - [ ] Validation logic explanation

- [ ] **Security basics**:
  - [ ] `.gitignore` created with standard Node entries
  - [ ] No `.env` files committed
  - [ ] Dependencies audited (`npm audit` — address critical/high)

## Live Testing (Post-Deploy)

- [ ] **Health check**: Visit deployed URL, page loads without errors
- [ ] **Run Agent once**: Click "Run Agent", wait for completion
  - [ ] Pipeline completes without 500 errors
  - [ ] Progress indicator shows all 5 stages
  - [ ] Results table renders (even if 0 companies)
- [ ] **Verify data quality** on results:
  - [ ] All returned companies have `emailVerified: true`
  - [ ] All `usPresence` are `true` (non-US)
  - [ ] All `fundingOrRevenue` show amounts in $1M–$5M range
  - [ ] All `industry` values are tech-related
  - [ ] No `null` values for required fields (name, website, founderOrCeoName)
- [ ] **CSV Export works**:
  - [ ] "Export CSV" button downloads file
  - [ ] CSV opens correctly in spreadsheet app
  - [ ] All 11 columns present with correct data
- [ ] **Achieve target**: ≥ 15 qualifying companies in a single run
  - [ ] If < 15: run again (max 3 rounds per run)
  - [ ] If consistently < 15: review query phrasings, consider adding sources

## Post-Launch Monitoring

- [ ] Set up error tracking (Sentry, LogRocket, or similar)
- [ ] Monitor API usage (SerpAPI, Anthropic, Abstract) for quota
- [ ] Log pipeline metrics (discovered, extracted, validated, verified per run)
- [ ] Alert on pipeline failures (5xx responses)

## Rollback Plan

- [ ] Previous deployment URL known
- [ ] Database not used (stateless) — rollback = redeploy previous version
- [ ] Environment variables backward compatible

## Definition of Done

All of the above checked + at least one successful live run producing ≥ 15 verified companies with 100% email verification rate.