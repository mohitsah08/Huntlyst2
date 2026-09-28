# Key Decisions

## 1. Deterministic Validation over LLM Self-Grading

**Decision**: Validation functions (`checkFundingRange`, `checkTechPlatform`, `checkNoUSPresence`) are pure TypeScript code with no LLM involvement.

**Why**: 
- LLMs are non-deterministic and can hallucinate
- Validation criteria are objective (numeric ranges, keyword lists, geographic indicators)
- Pure functions are testable, auditable, and predictable
- Eliminates "LLM grader bias" where model might be lenient on its own extractions

**Trade-off**: Requires maintaining keyword lists and regex patterns manually.

---

## 2. Three-State US Presence Check

**Decision**: `checkNoUSPresence()` returns `true` (non-US), `false` (US), or `null` (undetermined). `null` = REJECT.

**Why**:
- Conservative approach: better to miss a valid non-US company than include a US one
- Many pages don't explicitly state location → `null` forces rejection
- Explicit non-US evidence required (city, country, region keywords)

**Trade-off**: Lower recall, higher precision. Some valid non-US companies will be rejected.

---

## 3. Email Verification Required for Inclusion

**Decision**: Companies only appear in final results if `emailVerified === true`. Unverified emails = candidate dropped.

**Why**:
- Core requirement: "verifiable CEO/co-founder email"
- Unverified emails are not actionable for outreach
- Prevents wasting sales team time on bounces

**Trade-off**: Significantly reduces yield. Many valid companies may lack verifiable email patterns.

---

## 4. Multi-Round Discovery with Early Exit

**Decision**: Run up to 3 discovery rounds, stop early if ≥ 15 qualified.

**Why**:
- Single round may not yield enough candidates
- Different query phrasings find different companies
- Early exit saves API credits and time when target met

**Trade-off**: More complex orchestration; cross-round deduplication needed.

---

## 5. Concurrency Limit of 5 for Extraction

**Decision**: `extractAllCandidates` uses 5 parallel workers.

**Why**:
- Avoids overwhelming target servers
- Respects typical rate limits
- Balances speed vs. reliability

**Trade-off**: Slower than unbounded parallelism; could be tuned per deployment.

---

## 6. Abstract API Verification as Optional Graceful Skip

**Decision**: If `ABSTRACT_API_KEY` not set, skip Abstract check. If set but API fails, treat as pass.

**Why**:
- Abstract API is a quality enhancement, not a hard requirement
- MX record check is the primary verification (free, reliable)
- Don't want API outages to block valid emails

**Trade-off**: May include some risky/deliverable emails when Abstract unavailable.

---

## 7. SerpAPI + Directory Scraping as Dual Sources

**Decision**: Two discovery sources with different characteristics.

**Why**:
- SerpAPI: High-quality search results, but costs credits
- Directories: Free but brittle (scraping, blocking, JS-heavy)
- Together provide better coverage than either alone

**Trade-off**: Directory scraping is unreliable; should be replaced with APIs.

---

## 8. Confidence Score Based on Field Completeness

**Decision**: `confidenceScore = nonNullVerifiedFields / 8`. Email only counts if verified.

**Why**:
- Simple, transparent metric
- Reflects data quality directly
- Enables meaningful sorting

**Trade-off**: Doesn't weight fields by importance (e.g., email vs. description).

---

## 9. No Streaming Progress (Simulated)

**Decision**: Frontend simulates progress; API returns complete result.

**Why**:
- Simpler implementation (no SSE/WebSocket)
- Next.js API routes don't easily support streaming in App Router
- 5-minute max duration means user waits anyway

**Trade-off**: User sees "jump" from 0% to 100% at end.

---

## 10. Client-Side CSV Export

**Decision**: CSV generated in browser via Blob download.

**Why**:
- No server round-trip needed
- Works with static export if needed
- Simple implementation

**Trade-off**: Large datasets may hit browser memory limits (not an issue at 20 rows).

---

## 11. Node.js Runtime (Not Edge)

**Decision**: `export const runtime = 'nodejs'` for API route.

**Why**:
- Uses `dns.promises.resolveMx()` (Node-only)
- Long-running (up to 5 min) — Edge has shorter limits
- Needs full Node.js APIs for DNS, fetch with timeout

**Trade-off**: Cannot deploy to Edge functions; requires Node.js hosting.

---

## 12. Cheerio for HTML Parsing (Not Playwright/Puppeteer)

**Decision**: Server-side Cheerio for text extraction.

**Why**:
- Fast, lightweight, no browser overhead
- Works in serverless environments
- Sufficient for static content sites

**Trade-off**: Fails on JavaScript-rendered content (SPAs, React apps).