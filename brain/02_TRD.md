# Technical Requirements Document (TRD)

## Stack

| Component | Version/Details |
|-----------|-----------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.6+ (strict mode) |
| **Runtime** | Node.js 18+ (native `fetch`, `dns/promises`, `AbortSignal.timeout`) |
| **Styling** | Tailwind CSS 3.4 |
| **HTML Parsing** | Cheerio 1.0 |
| **LLM** | Anthropic SDK 0.27+, model `claude-sonnet-4-6` |
| **Search API** | SerpAPI (Google Custom Search) |
| **Email Verification** | Node `dns.promises.resolveMx()` + optional Abstract API |

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SERPAPI_KEY` | Yes | SerpAPI key for Google search (free tier: 100 searches/month) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `ABSTRACT_API_KEY` | No | Abstract API for email deliverability check (free tier: 100 requests/month) |

## Performance Expectations

| Metric | Target |
|--------|--------|
| Max pipeline duration | 300 seconds (5 minutes) — enforced by `maxDuration = 300` |
| Discovery per round | ~50-100 candidates |
| Extraction concurrency | 5 parallel fetches (configurable) |
| LLM max tokens | 1024 per request, temperature 0 |
| Page fetch timeout | 15 seconds |
| SerpAPI request timeout | Default (no explicit timeout, relies on fetch) |
| Abstract API timeout | 10 seconds |
| Max discovery rounds | 3 |
| Max results returned | 20 (top by confidence) |

## Concurrency Limits

- **Extraction**: 5 parallel workers (hardcoded in `extractAllCandidates`)
- **Email verification**: Unlimited parallel (uses `Promise.allSettled` on all validated companies)
- **Discovery sources**: Run in parallel via `Promise.allSettled`

## Error Handling Requirements

| Stage | Failure Mode | Behavior |
|-------|--------------|----------|
| Discovery (SerpAPI) | API error / quota exceeded | Log error, continue with other sources |
| Discovery (Directories) | Fetch fails / HTML parse fails | Log error, return empty array for that directory |
| Extraction (fetch) | Non-200 / timeout / non-HTML | Return `null`, candidate dropped |
| Extraction (LLM) | API error / malformed JSON | Log error, candidate dropped |
| Validation | Any check fails | Candidate rejected (not added to validated list) |
| Email (MX) | DNS resolution fails | Email marked unverified, try next pattern |
| Email (Abstract) | API error / timeout | Treat as pass (don't fail on optional API) |
| Ranking | No companies qualify | Return empty array, pipeline continues |

## API Route Configuration

```typescript
export const runtime = 'nodejs';           // Not edge runtime
export const dynamic = 'force-dynamic';    // No caching
export const maxDuration = 300;            // 5 min timeout (Vercel/Node)
```

## Input/Output

- **Input**: POST to `/api/run-agent` with empty body
- **Output**: JSON `{ companies: CompanyRecord[], totalDiscovered: number, totalQualified: number }`
- **Errors**: 500 with `{ error: string }` if required env vars missing