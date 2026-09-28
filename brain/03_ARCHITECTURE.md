# Architecture

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           POST /api/run-agent                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        1. DISCOVERY (lib/discovery.ts)                      │
│  ┌─────────────────────┐         ┌─────────────────────────────────────┐   │
│  │ SerpApiSource       │         │ StartupDirectorySource              │   │
│  │ - 5 query phrasings │         │ - 5 directory URLs                  │   │
│  │ - SerpAPI (Google)  │         │ - Regex HTML scraping               │   │
│  │ - Returns 10/query  │         │ - Returns ≤20 per directory         │   │
│  └──────────┬──────────┘         └──────────────┬──────────────────────┘   │
│             │                                    │                         │
│             └──────────────┬─────────────────────┘                         │
│                            ▼                                                │
│              Merge + Deduplicate by domain                                 │
│                            │                                                │
│                            ▼                                                │
│                 CandidateUrl[] { url, snippet, source }                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       2. EXTRACTION (lib/extraction.ts)                     │
│  For each candidate (parallel, concurrency=5):                             │
│  1. fetchPageText() → HTML with 15s timeout, proper headers                │
│  2. extractTextFromHtml() → Cheerio: strip script/style/nav/footer/ads     │
│  3. extractCompanyData() → Anthropic Claude with SYSTEM_PROMPT             │
│  4. parseLLMResponse() → Strip code fences, validate JSON shape            │
│                                                                             │
│  Output: Map<url, ExtractedCompanyData>                                    │
│  ExtractedCompanyData = { name, description, industry, fundingOrRevenueText,│
│                           usPresenceEvidence, founderOrCeoName }           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       3. VALIDATION (lib/validation.ts)                     │
│  For each extracted company (deterministic, no LLM):                       │
│  - checkFundingRange(fundingOrRevenueText) → boolean                       │
│  - checkTechPlatform(description, industry) → boolean                      │
│  - checkNoUSPresence(usPresenceEvidence) → true | false | null            │
│  - founderOrCeoName non-empty?                                             │
│  - name non-empty?                                                         │
│                                                                             │
│  ALL must pass (null = fail). Output: ValidatedCompany[]                   │
│  ValidatedCompany = ExtractedCompanyData + website + sourceType            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    4. EMAIL VERIFICATION (lib/email.ts)                     │
│  For each validated company (parallel):                                    │
│  1. extractDomain(website) → root domain                                   │
│  2. parseName(founderOrCeoName) → { first, last }                          │
│  3. generateEmailGuesses() → 5 patterns:                                   │
│     first@domain, first.last@domain, f.last@domain,                        │
│     first_last@domain, last@domain                                         │
│  4. For each guess:                                                        │
│     - checkMxRecords(domain) → boolean (required)                          │
│     - verifyWithAbstractApi(email) → boolean (optional, graceful skip)     │
│  5. First verified email wins                                              │
│                                                                             │
│  Output: Map<website, EmailVerificationResult>                             │
│  EmailVerificationResult = { email: string | null, verified: boolean }     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      5. RANKING & DEDUPE (lib/rank.ts)                      │
│  1. buildCompanyRecord(validated, emailResult) → CompanyRecord             │
│     - Only if emailResult.verified === true                                │
│  2. computeConfidenceScore() = non-null fields / 8 required fields         │
│  3. deduplicateByDomain() → keep highest confidence                        │
│  4. sortByConfidence() descending                                          │
│  5. Return top 20                                                          │
│                                                                             │
│  CompanyRecord = { name, website, description, industry, fundingOrRevenue, │
│                    usPresence, founderOrCeoName, founderOrCeoEmail,        │
│                    emailVerified, confidenceScore, sourceType }            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        6. API RESPONSE (route.ts)                           │
│  Run up to 3 discovery rounds until ≥15 qualified or max rounds            │
│  Aggregate across rounds, deduplicate again                                │
│  Return RunAgentResult = { companies, totalDiscovered, totalQualified }    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       7. FRONTEND (app/page.tsx)                            │
│  - "Run Agent" button → POST /api/run-agent                                │
│  - Simulated progress bar (5 stages)                                       │
│  - Results table with 10 columns                                           │
│  - "Export CSV" → client-side CSV generation/download                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module File Paths

| Module | File | Exports |
|--------|------|---------|
| Types | `lib/types.ts` | All interfaces |
| Discovery | `lib/discovery.ts` | `discoverCompanies()`, `SerpApiSource`, `StartupDirectorySource` |
| Extraction | `lib/extraction.ts` | `extractAllCandidates()`, `extractCompanyData()`, `fetchPageText()` |
| Validation | `lib/validation.ts` | `checkFundingRange()`, `checkTechPlatform()`, `checkNoUSPresence()`, `validateCompany()` |
| Email | `lib/email.ts` | `findVerifiedEmail()`, `generateEmailGuesses()`, `checkMxRecords()` |
| Ranking | `lib/rank.ts` | `rankCompanies()`, `buildCompanyRecord()`, `needsMoreDiscovery()`, `MAX_DISCOVERY_ROUNDS` |
| API | `app/api/run-agent/route.ts` | `POST` handler |
| Frontend | `app/page.tsx` | `HomePage` component |

## Data Flow Types

```
CandidateUrl → ExtractedCompanyData → ValidatedCompany → CompanyRecord
     │              │                      │                │
     ▼              ▼                      ▼                ▼
(url, snippet,  (6 nullable    (6 required +    (8 fields +
 source)        fields)         website,         confidence,
                                       sourceType)   emailVerified)
```