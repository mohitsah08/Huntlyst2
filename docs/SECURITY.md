# Security Policy & Secret Hygiene — TVB Huntlyst

## 1. Zero Secret Exposure
- No API keys, tokens, database credentials, or secret variables may ever be committed to git or exposed to client-side bundles.
- All dynamic keys (`ANTHROPIC_API_KEY`, `BRAVE_API_KEY`, `SERPAPI_KEY`, `PERPLEXITY_API_KEY`) must strictly reside in server-side `.env.local` or Vercel Environment Variables.
- `.env.example` documents required variable keys without values.

## 2. Scraping & Network Safety
- Respectful concurrency controls on web requests.
- Strict header isolation prevents credential leakage across external network requests.
- Domain-isolated cache scoping ensures sensitive customer or target records do not cross boundaries.
