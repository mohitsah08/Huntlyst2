# Master Rules — Non-Negotiable

These rules must never be violated. Any change that conflicts with these rules must be rejected.

## Data Integrity

1. **Never guess or fabricate a field** — If a field cannot be confidently verified from real source evidence, leave it `null`. Never populate with plausible-sounding generic data.

2. **Never treat "undetermined US presence" as a pass** — `checkNoUSPresence()` returns `true` (non-US), `false` (US), or `null` (undetermined). A `null` result means REJECT the candidate. Do not default to pass.

3. **Never return an unverified email** — `emailVerified` must be `true` only if MX record check passes (and Abstract API check passes if configured). If no email verifies, the candidate is dropped entirely — do not include with `emailVerified: false`.

4. **No hardcoded API keys** — All secrets must come from environment variables (`SERPAPI_KEY`, `ANTHROPIC_API_KEY`, `ABSTRACT_API_KEY`). Never commit secrets to git.

5. **Every candidate must independently pass all validation checks** — A candidate survives only if:
   - `checkFundingRange()` returns `true` (strictly $1M–$5M)
   - `checkTechPlatform()` returns `true`
   - `checkNoUSPresence()` returns `true` (explicitly non-US)
   - Has a founder/CEO name (non-empty)
   - Has a company name (non-empty)
   - Has a verified email

## Pipeline Behavior

6. **Precision over recall** — Never pad the results list with unverified data to hit the 15-company target. Better to return fewer verified companies than more unverified ones.

7. **Graceful degradation** — A failure on one candidate must not crash the whole run. Drop the failed candidate and continue. Use `Promise.allSettled` and try/catch at each step.

8. **Deterministic validation** — Validation functions (`checkFundingRange`, `checkTechPlatform`, `checkNoUSPresence`) must be pure, deterministic code. No LLM self-grading.

9. **Real data only** — Every returned field must trace back to an actual discovery → extraction → validation step. No mock/fake data anywhere in production code.

10. **Deduplication by domain** — Companies are deduplicated by root domain (e.g., `example.com` matches `www.example.com`). Keep the record with the highest confidence score.

## Code Quality

11. **TypeScript strict mode** — All code must compile with `strict: true`. No `any` types unless absolutely necessary.

12. **No silent failures** — Log errors at each stage with context (URL, stage, error message). Do not swallow exceptions without logging.

13. **Concurrency limits** — Respect the concurrency limit (default 5) for parallel HTTP fetches to avoid overwhelming targets or hitting rate limits.