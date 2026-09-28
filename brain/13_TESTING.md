# Testing

## Current Test Coverage

**None** — No test files exist in the project. No unit tests, integration tests, or e2e tests.

## What Should Be Tested

### Priority 1: Validation Functions (Pure, Deterministic)

**File**: `lib/validation.ts`

| Function | Test Cases |
|----------|------------|
| `checkFundingRange` | "$2.5M" → true; "$500k" → false; "$10M" → false; "€3M" → true; "£2M" → true; "revenue $3M" → true; null → false; "no numbers" → false |
| `checkTechPlatform` | "SaaS platform" → true; "fintech startup" → true; "restaurant" → false; "consulting services" → false; "AI/ML" → true; null → false; empty string → false |
| `checkNoUSPresence` | "based in Berlin" → true; "headquartered in London" → true; "HQ in San Francisco" → false; "US office in NYC" → false; "serving European markets" → true; "global company" → null; null → null |
| `validateCompany` | All valid → returns data; funding fail → null; tech fail → null; US presence fail → null; missing founder → null; missing name → null |

### Priority 2: Email Functions

**File**: `lib/email.ts`

| Function | Test Cases |
|----------|------------|
| `extractDomain` | "https://example.com" → "example.com"; "https://www.example.com" → "example.com"; invalid → "" |
| `parseName` | "John Smith" → {first: "john", last: "smith"}; "Jane" → {first: "jane", last: ""}; "  " → null |
| `generateEmailGuesses` | "John Smith", "example.com" → 5 guesses; "Jane", "test.com" → 1 guess; "", "" → [] |
| `checkMxRecords` | Mock DNS resolution (requires test double) |

### Priority 3: Ranking Functions

**File**: `lib/rank.ts`

| Function | Test Cases |
|----------|------------|
| `computeConfidenceScore` | All 8 fields → 1.0; 4 fields → 0.5; email unverified → not counted |
| `deduplicateByDomain` | Two companies same domain → keeps higher confidence |
| `buildCompanyRecord` | Valid inputs → correct CompanyRecord |
| `rankCompanies` | Unverified emails filtered out; sorted by confidence |

### Priority 4: Discovery Sources

**File**: `lib/discovery.ts`

| Function | Test Cases |
|----------|------------|
| `extractDomain` | Various URL formats |
| `deduplicateByDomain` | Multiple candidates, same domain |
| `SerpApiSource.search` | Mock fetch response → correct parsing |
| `StartupDirectorySource.extractLinksFromHtml` | Sample HTML → correct links |

### Priority 5: Extraction

**File**: `lib/extraction.ts`

| Function | Test Cases |
|----------|------------|
| `extractTextFromHtml` | HTML with scripts/styles → clean text; missing main → falls back to body |
| `parseLLMResponse` | Valid JSON → parsed; with code fences → stripped; missing fields → null; malformed → null |

### Priority 6: Integration / E2E

- Full pipeline with mocked external APIs
- API route: POST returns correct shape
- Frontend: button click → loading → results render

## Test Framework Recommendations

| Type | Tool |
|------|------|
| Unit | Vitest (fast, TypeScript-native) |
| Integration | Vitest with MSW (mock service worker) |
| E2E | Playwright |

## Test Commands (to add to package.json)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Mocking Strategy

- **SerpAPI**: Mock `fetch` to return predefined `organic_results`
- **Anthropic**: Mock `anthropic.messages.create` to return predefined `ExtractedCompanyData`
- **DNS**: Mock `dns.promises.resolveMx` for MX checks
- **Abstract API**: Mock `fetch` for email verification
- **Directory scraping**: Mock `fetch` with sample HTML fixtures