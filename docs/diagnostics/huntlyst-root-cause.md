# Huntlyst Root-Cause Forensic Audit Report

**Audit Date**: October 2026  
**Audited Artifacts**:
- `reference_data/huntlyst_qualified_leads_2026_09_29.csv` (37 candidate output rows)
- `reference_data/growth_list_may_2024.csv` (100 reference benchmark rows)
- `lib/rank.ts`, `lib/validation.ts`, `lib/targetProfileData.ts`, `lib/extraction.ts`, `lib/fileParser.ts`, `lib/contactEnrichment.ts`

---

## Executive Summary

A forensic audit of the Huntlyst validation, discovery, and scoring pipeline revealed that systemic inaccuracies in output leads stemmed from **deterministic code bugs, coarse point bucket scoring, silent boundary tolerances, regex pattern leakage, and ambiguous target profile semantics**, rather than AI model deficiencies. 

This audit documents each root cause (Items A through K) with code locations, causal mechanisms, and technical remediations.

---

## Forensic Audit: Items A through K

### A. The "92 / 100" Score Clustering Bug
- **Symptom**: In `huntlyst_qualified_leads_2026_09_29.csv`, **36 out of 37 leads** (97.3%) received the exact same score of `92 / 100`.
- **Location**: `lib/rank.ts` (`calculateHuntScore`, lines 55–141).
- **Root Cause**: The scoring function was structured as coarse integer point buckets that awarded maximum points for broad keyword presence:
  - **Funding Fit (20/20)**: Awarded full 20 pts if string contained symbols like `$`, `€`, `£`, or `m` (line 67).
  - **Technology Fit (20/20)**: Awarded full 20 pts if industry or description contained "saas", "software", "ai", etc. (line 94).
  - **Geography Fit (18/20)**: Awarded 18 pts if `record.country` did not contain "united states" (line 114).
  - **Founder Fit (20/20)**: Awarded full 20 pts if `founder.trim().length >= 4` (line 122).
  - **Contact Fit (14/20)**: Awarded 14 (or 12) pts if email existed but was unverified (line 133).
  - **Sum**: `20 + 20 + 18 + 20 + 14 = 92`!
- **Impact**: Any non-US company with a dollar sign in funding text, a 4+ character founder name, and an unverified email address received an artificial, uncalibrated score of 92, rendering ranking useless.
- **Fix**: Replace coarse point addition with a continuous, granular, deterministic multi-factor formula evaluating:
  1. Exact percentage closeness to target funding range midpoint.
  2. Taxonomy depth of sector/subsector alignment.
  3. Exactness of geographic match (Country match vs Region match vs Global).
  4. Decision-maker verification grade (CEO vs Founder vs generic executive).
  5. Contact deliverability grade (DNS MX verified professional email vs domain match vs missing).

---

### B. US Companies Rejected Under "Global" Geography
- **Symptom**: Selecting "Global" as Target Region still caused US-headquartered companies to be rejected.
- **Location**: `lib/targetProfileData.ts` (line 1981) and `lib/validation.ts` (lines 500–503).
- **Root Cause**:
  1. `lib/targetProfileData.ts` line 1981 contained:
     ```typescript
     excludedCountries: profile.excludedCountries || ['United States']
     ```
     When `profile.excludedCountries` was empty or omitted, it silently defaulted to `['United States']`.
  2. `lib/validation.ts` line 501 checked:
     ```typescript
     if (excluded.includes('united states') && (detectedName === 'United States' || usVerdict === true))
     ```
     Because United States was silently excluded by default, any US company was hard-rejected even if the user wanted a true global hunt.
- **Fix**: Remove the forced `['United States']` default when `regions` includes `'Global'` or `excludedCountries` is empty. Exclude US *only* when the user explicitly chooses an Exclude US presence mode or adds United States to `excludedCountries`.

---

### C. Semantic Confusion: "Global" vs "Exclude US Presence"
- **Symptom**: Users faced conflicting UI options where "Global" was selected, but "Exclude US Companies (Non-US)" was simultaneously applied, without clear distinction between headquarters, remote presence, or market focus.
- **Location**: `lib/types.ts` (`HuntGeographyConfig`), `lib/targetProfileData.ts` (`usPresenceMode`), and `lib/validation.ts` (`checkNoUSPresence`).
- **Root Cause**: The system used inconsistent enum values (`'strictly_none'`, `'minimal_or_none'`, `'exclude_us'`, `'any'`, `'dont_care'`) across different files without standardized definitions.
- **Fix**: Standardize on 4 explicit, well-defined US Presence modes across the entire application:
  1. `no_restriction`: US headquarters and presence are fully permitted.
  2. `exclude_us_hq`: Companies with headquarters in the US are rejected; non-US companies with minor US sales/subsidiaries are permitted.
  3. `exclude_us_presence`: Any documented US office, phone number (+1), or state presence triggers rejection.
  4. `require_us`: Only US-headquartered or US-operating companies pass.

---

### D. Funding Range Flaws: Silent 10% Grace Buffer & Text Parsing
- **Symptom**: Companies with funding above the configured maximum (e.g. $10.5M when max was $10.0M) were permitted, while valid companies were rejected due to unparsed strings.
- **Location**: `lib/validation.ts` (lines 278–281):
  ```typescript
  // 10% grace buffer for currency fluctuation and seed ranges
  const lowerBound = minVal * 0.9;
  const upperBound = maxVal * 1.1;
  ```
- **Root Cause**: 
  1. A hardcoded `0.9` and `1.1` multiplier extended $100K–$10M to $90K–$11M, violating deterministic boundary constraints.
  2. Funding was evaluated as raw strings rather than normalized numerical amounts in USD with currency tags.
- **Fix**:
  1. Eliminate the silent grace buffer: boundary evaluation must be strict (`candidateVal >= minVal && candidateVal <= maxVal`).
  2. Model funding as structured fields: `amount_raw`, `amount_usd`, `currency`, `round_type`, `round_date`.
  3. Enforce strict currency conversion (e.g., INR to USD, EUR to USD, GBP to USD) before range comparison.

---

### E. Email Verification Misleading States
- **Symptom**: Leads displayed synthesized emails as "Verified Email" in table views even when SMTP deliverability was unverified.
- **Location**: `lib/types.ts`, `lib/rank.ts`, and `lib/export.ts`.
- **Root Cause**: Boolean `emailVerified: boolean` conflated DNS MX mail server existence with actual mailbox deliverability verification.
- **Fix**: Adopt strict, unambiguous verification states across the data model:
  - `VERIFIED_DELIVERABLE`: Physical mailbox confirmed via SMTP handshake/API.
  - `MX_VALIDATED`: Mail domain has active MX DNS records and accepts mail, but individual inbox is unprobed.
  - `SYNTHESIZED_UNVERIFIED`: Pattern constructed (`first@domain`) without DNS verification.
  - `UNAVAILABLE`: Domain does not support email or has no MX records.
  - `NOT_FOUND`: No email discoverable from any source.

---

### F. Growth List CSV Ingestion & Input Preservation Flaws
- **Symptom**: When importing `Growth List Free Forever - May 2024.csv`, funding amounts were missing or failed to qualify.
- **Location**: `lib/fileParser.ts` (`extractCandidateFromRecord`, lines 123–128).
- **Root Cause**:
  In Growth List CSV, Column 12 is `Funding Date` ("May 2024") and Column 13 is `Funding Amount (in USD)` ("$3,440,421").
  The code had:
  ```typescript
  else if (!funding && (k === 'funding' || k === 'revenue' || k === 'raised' || k.includes('funding') || k.includes('revenue'))) {
    funding = v;
  }
  ```
  Because `k.includes('funding')` matched `Funding Date` first, `funding` was populated with `"May 2024"`.
  When Column 13 (`Funding Amount (in USD)`) was processed, `!funding` was `false`, causing the actual dollar amount to be discarded!
- **Fix**: Priority-based header matching that explicitly extracts `funding_amount`, `funding_date`, and `funding_type` into distinct structured fields.

---

### G. Decision Architecture: Deterministic Rules vs Heuristics vs LLM
- **Symptom**: Unclear boundary between code-enforced rules and LLM hallucination.
- **Audit Findings**:
  - Deterministic:
    - Geography / Country string matching & ISO code lookup (`lib/validation.ts`)
    - DNS MX resolution (`dns.resolveMx`)
    - Numerical range checks (`min <= x && x <= max`)
  - Heuristics:
    - Free-text regex pattern extraction for funding and names (`lib/extraction.ts`)
    - Substring industry categorization (`lib/validation.ts`)
  - LLM Calls:
    - Optional Anthropic fallback in `lib/extraction.ts` if API key is present.
- **Rule Enforced**: Deterministic criteria (revenue, funding, location, email MX) must ALWAYS be enforced by code. LLM is restricted to semantic understanding of unstructured company descriptions without overriding deterministic facts.

---

### H. CEO Name Truncation and "and" Trailing Artifacts
- **Symptom**: In `huntlyst_qualified_leads_2026_09_29.csv`, founder names appeared as `"Olivier Eyries and"` and `"Manuela Ticudean and"`.
- **Location**: `lib/extraction.ts` (line 182) and `lib/contactEnrichment.ts`.
- **Root Cause**:
  The regex used case-insensitive flag `/i`:
  ```typescript
  snippet.match(/(?:founded by|co-founded by|founder|ceo:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i);
  ```
  In `"Co-founded by Olivier Eyries and Eric Blavier"`, the word `"and"` matched the pattern `[A-Z][a-z]+` because of `/i`. The regex stopped at the second word, capturing `"Olivier Eyries and"`!
- **Fix**:
  1. Add post-processing cleanup: `.replace(/\s+(?:and|or|with|&)\s*$/i, '').trim()`.
  2. Strip non-person placeholders like `"UPGRADE TO UNLOCK"`.

---

### I. Match Percentage vs Confidence Score vs Qualification Score
- **Symptom**: "Hunt Score", "Confidence Score", and "Match %" were used interchangeably across components.
- **Root Cause**: `lib/types.ts` defined both `confidenceScore` (0.0 to 1.0) and `huntScore` (0 to 100), with differing formulas.
- **Fix**: Clarify definitions:
  - **Match Score (0–100%)**: Deterministic measure of how closely the company matches the user's specific target criteria (Geography 25%, Funding 25%, Sector 25%, Executive 25%).
  - **Data Confidence Score (0–100%)**: Completeness and physical verifiability of the underlying data points.
  - **Qualification Status**: Discrete enum: `QUALIFIED`, `PARTIAL_MATCH`, `REJECTED`, or `UNDER_REVIEW`.

---

### J. "Funding OR Revenue" Semantic Conflation
- **Symptom**: When `funding_or_revenue` was chosen, the system could not distinguish whether a company qualified on investment or top-line sales.
- **Root Cause**: Single string field `fundingOrRevenue` stored whichever string snippet appeared first.
- **Fix**: Structure data into `funding` object (`totalRaisedUsd`, `stage`) and `revenue` object (`annualRevenueUsd`, `isProfitable`), with separate verification provenance.

---

### K. Comprehensive Inventory of Qualification Criteria & Deterministic Formulas

| Criterion | Deterministic Evaluation Formula | Pass / Fail Condition |
| :--- | :--- | :--- |
| **Geography** | `countryMatch(company.country, target.countries) && checkUSPresence(company, target.usMode)` | `true` if within target countries and complies with US presence mode. |
| **Funding** | `company.fundingUsd >= target.fundingMin && company.fundingUsd <= target.fundingMax` | `true` if strictly within `[min, max]`. Zero grace buffer. |
| **Revenue** | `company.revenueUsd >= target.revenueMin && company.revenueUsd <= target.revenueMax` | `true` if strictly within `[min, max]`. |
| **Financial Metric** | `metricMode === 'funding' ? fundingPass : metricMode === 'revenue' ? revPass : (fundingPass || revPass)` | Deterministic switch on configured metric mode. |
| **Sector / Tech** | `taxonomyMatch(company.industry, company.description, target.sectors, target.subIndustries)` | `true` if sector keyword or subsector alias matches normalized taxonomy. |
| **Executive** | `hasRequiredRole(company.executives, target.contactPersonTypes)` | `true` if executive with verified title exists. |
| **Email Verification** | `target.emailReq === 'Required' ? (email.hasMx && email.status === 'valid') : true` | `true` if MX verified when email is required. |
