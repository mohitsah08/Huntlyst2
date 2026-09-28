# Error Handling

## Current Error Handling by Stage

### 1. Discovery (`lib/discovery.ts`)

| Source | Error Type | Handling |
|--------|------------|----------|
| SerpAPI | Network error, 4xx/5xx, JSON parse | `try/catch` per query, logs error, continues to next query |
| SerpAPI | Missing `SERPAPI_KEY` | Source skipped entirely (not added to sources array) |
| Directories | Fetch timeout (10s), network error, non-200 | `try/catch` per directory, returns `[]` for that directory |
| Directories | Regex parse failure | Regex won't throw; invalid URLs caught in `try/catch` |
| Merge | `Promise.allSettled` | Fulfilled: add results; Rejected: log error, continue |

**Gap**: No retry logic for transient failures.

---

### 2. Extraction (`lib/extraction.ts`)

| Step | Error Type | Handling |
|------|------------|----------|
| `fetchPageText` | Timeout (15s), network, non-200, non-HTML | Returns `null`, logs warning |
| `extractTextFromHtml` | Cheerio load failure | Not wrapped — would throw (uncaught) |
| `extractCompanyData` | Insufficient text (<500 chars) | Returns `null`, logs warning |
| Anthropic API | Network, 4xx/5xx, rate limit | `try/catch`, returns `null`, logs error |
| `parseLLMResponse` | Malformed JSON, missing fields | Returns `null`, logs error |
| `extractAllCandidates` | Worker throws | Not wrapped — worker errors would crash `Promise.all` |

**Gaps**:
- `extractTextFromHtml` not wrapped in try/catch
- Worker errors in `extractAllCandidates` not caught individually
- No retry for transient LLM failures

---

### 3. Validation (`lib/validation.ts`)

| Function | Error Type | Handling |
|----------|------------|----------|
| `parseFundingAmount` | Regex match failure | Returns `null` (not an error) |
| `checkFundingRange` | `null` input | Returns `false` |
| `checkTechPlatform` | `null` input | Returns `false` |
| `checkNoUSPresence` | `null` input | Returns `null` (treated as reject) |
| `validateCompany` | Any check fails | Returns `null` (candidate rejected) |

**Notes**:
- All validation functions are pure and deterministic
- No external dependencies → no network/IO errors possible
- `null` return from `validateCompany` = candidate dropped

---

### 4. Email Verification (`lib/email.ts`)

| Step | Error Type | Handling |
|------|------------|----------|
| `extractDomain` | Invalid URL | Returns `''` (empty string) |
| `parseName` | Empty/invalid name | Returns `null` |
| `generateEmailGuesses` | No domain/name | Returns `[]` |
| `checkMxRecords` | DNS resolution failure | Returns `false` (not an error) |
| `verifyWithAbstractApi` | No API key | Returns `true` (skip gracefully) |
| `verifyWithAbstractApi` | Network, 4xx/5xx, timeout | Returns `true` (don't fail on optional API) |
| `verifyEmail` | No domain | Returns `{ email, verified: false }` |
| `findVerifiedEmail` | No domain | Returns `{ email: null, verified: false }` |
| `findVerifiedEmail` | All guesses fail | Returns `{ email: null, verified: false }` |

**Design Choice**: Abstract API errors treated as "pass" to avoid false negatives from API issues.

---

### 5. Ranking (`lib/rank.ts`)

| Step | Error Type | Handling |
|------|------------|----------|
| `buildCompanyRecord` | Invalid input | Not validated — assumes valid input |
| `extractDomain` (reused) | Invalid URL | Returns `''` |
| `deduplicateByDomain` | Empty domain | Treated as unique key `''` |
| `rankCompanies` | No verified emails | Returns `[]` |

**Gap**: No input validation on `buildCompanyRecord`.

---

### 6. API Route (`app/api/run-agent/route.ts`)

| Error | Handling |
|-------|----------|
| Missing `SERPAPI_KEY` | Returns 500 with error message |
| Missing `ANTHROPIC_API_KEY` | Returns 500 with error message |
| Pipeline exception | Not caught — would return 500 with stack trace |
| Round failure | `processDiscoveryRound` errors not caught — would crash |

**Gaps**:
- No try/catch around the main pipeline loop
- No timeout handling beyond `maxDuration`
- No structured error response for pipeline failures

---

### 7. Frontend (`app/page.tsx`)

| Error | Handling |
|-------|----------|
| Network error | Caught, sets error state |
| Non-200 response | Parses JSON error, shows message |
| JSON parse failure | Caught, shows "Unknown error" |
| CSV generation | Not wrapped — would throw silently |

**Gap**: No retry UI, no timeout handling for long runs.

---

## Summary of Gaps

| Priority | Gap | Impact |
|----------|-----|--------|
| High | No try/catch around main pipeline loop | Unhandled exception = 500 with stack trace |
| High | `extractTextFromHtml` not wrapped | Cheerio error crashes extraction |
| High | Worker errors in `extractAllCandidates` | One bad candidate crashes all extraction |
| Medium | No retry logic for transient failures | Temporary network issues cause permanent drops |
| Medium | No structured error responses from API | Frontend gets generic 500 |
| Low | No request deduplication | Same URL may be fetched multiple times |
| Low | No robots.txt compliance | Potential ToS violations |

---

## Error Handling Philosophy

Per Master Rules: **Graceful degradation** — A failure on one candidate must not crash the whole run. Drop the failed candidate and continue.

Current implementation mostly follows this, but gaps exist at the orchestration level (API route) and in some utility functions.