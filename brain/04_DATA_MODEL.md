# Data Model

## CompanyRecord (Final Output)

```typescript
type CompanyRecord = {
  name: string;                    // Required, non-empty
  website: string;                 // Required, valid URL
  description: string | null;      // 1-2 sentence summary or null
  industry: string | null;         // e.g., "SaaS", "Fintech" or null
  fundingOrRevenue: string | null; // Raw text snippet: "raised $2.5M Series A"
  usPresence: boolean | null;      // true = non-US, false = US, null = undetermined
  founderOrCeoName: string | null; // Full name or null
  founderOrCeoEmail: string | null; // Verified email or null
  emailVerified: boolean;          // true only if MX (+ Abstract) verified
  confidenceScore: number;         // 0.0–1.0 (non-null fields / 8)
  sourceType: string;              // "SerpAPI" or "StartupDirectories"
};
```

**Required fields (8 total)**: `name`, `website`, `description`, `industry`, `fundingOrRevenue`, `usPresence`, `founderOrCeoName`, `founderOrCeoEmail`

**Confidence calculation**: `nonNullVerifiedFields / 8`. Only counts `founderOrCeoEmail` if `emailVerified === true`.

## Intermediate Types

### CandidateUrl (Discovery Output)

```typescript
interface CandidateUrl {
  url: string;        // Company website URL
  snippet: string;    // Search result snippet / directory listing text
  source: string;     // "SerpAPI" or "StartupDirectories"
}
```

### ExtractedCompanyData (LLM Output)

```typescript
interface ExtractedCompanyData {
  name: string | null;
  description: string | null;
  industry: string | null;
  fundingOrRevenueText: string | null;  // Raw text from page
  usPresenceEvidence: string | null;    // Raw text snippet
  founderOrCeoName: string | null;
}
```

All fields nullable. LLM instructed to return `null` if not confident.

### ValidatedCompany (Post-Validation)

```typescript
interface ValidatedCompany {
  name: string;                    // Required (validation ensures non-null)
  website: string;                 // Required (from candidate URL)
  description: string | null;
  industry: string | null;
  fundingOrRevenueText: string | null;
  usPresenceEvidence: string | null;
  founderOrCeoName: string | null; // Required (validation ensures non-null)
  sourceType: string;              // From candidate source
}
```

Validation guarantees: `name`, `founderOrCeoName` non-null; `usPresenceEvidence` indicates non-US.

### EmailVerificationResult

```typescript
interface EmailVerificationResult {
  email: string | null;
  verified: boolean;   // true only if MX + (Abstract if configured) pass
}
```

### RunAgentResult (API Response)

```typescript
interface RunAgentResult {
  companies: CompanyRecord[];
  totalDiscovered: number;   // Total candidates across all rounds
  totalQualified: number;    // Final qualified count after all rounds
}
```

### ProgressStage (Frontend Only)

```typescript
interface ProgressStage {
  stage: string;
  message: string;
  completed: boolean;
  current: number;
  total: number;
}
```

## ValidationResult (Debug/Reporting)

```typescript
interface ValidationResult {
  passed: boolean;
  fundingCheck: boolean;
  techPlatformCheck: boolean;
  usPresenceCheck: boolean | null;
  hasFounderName: boolean;
  hasCompanyName: boolean;
  details: string[];  // Human-readable failure reasons
}
```

## Type Relationships

```
CandidateUrl (discovery)
    │
    ├─[fetch + LLM]─▶ ExtractedCompanyData (all nullable)
    │
    └─[validateCompany]──▶ ValidatedCompany (name, founderOrCeoName required)
                               │
                               ├─[findVerifiedEmail]──▶ EmailVerificationResult
                               │
                               └─[buildCompanyRecord]──▶ CompanyRecord (final)
                                                                   │
                                                                   └─[rankCompanies]──▶ CompanyRecord[] (sorted, deduped)
```