# API Contract: POST /api/run-agent

## Request

**Method**: `POST`

**URL**: `/api/run-agent`

**Headers**:
```
Content-Type: application/json
```

**Body**: Empty object `{}` (no parameters required)

**Authentication**: None (public endpoint — consider adding auth for production)

---

## Response

### Success (200 OK)

```json
{
  "companies": [
    {
      "name": "string",
      "website": "string",
      "description": "string | null",
      "industry": "string | null",
      "fundingOrRevenue": "string | null",
      "usPresence": true | false | null,
      "founderOrCeoName": "string | null",
      "founderOrCeoEmail": "string | null",
      "emailVerified": true | false,
      "confidenceScore": 0.0,
      "sourceType": "string"
    }
  ],
  "totalDiscovered": 0,
  "totalQualified": 0
}
```

**Notes**:
- `companies` array sorted by `confidenceScore` descending
- Max 20 companies returned (top 20 after ranking)
- `usPresence`: `true` = non-US, `false` = US, `null` = undetermined (should not occur in results since validation requires `true`)
- `emailVerified`: Always `true` for returned companies (unverified emails filtered out in ranking)
- `confidenceScore`: Range 0.0–1.0, computed as `nonNullVerifiedFields / 8`

### Error Responses

#### 500 Internal Server Error — Missing Environment Variables

```json
{
  "error": "SERPAPI_KEY environment variable is required"
}
```

```json
{
  "error": "ANTHROPIC_API_KEY environment variable is required"
}
```

#### 500 Internal Server Error — Other Failures

```json
{
  "error": "Request failed: 500"
}
```

(Any unhandled exception in the pipeline returns 500 with error message)

---

## Behavior

1. **Validates env vars** on entry — returns 500 immediately if `SERPAPI_KEY` or `ANTHROPIC_API_KEY` missing
2. **Runs up to 3 discovery rounds** (configurable via `MAX_DISCOVERY_ROUNDS`)
3. **Stops early** if ≥ 15 qualified companies found
4. **Aggregates across rounds** with cross-round deduplication
5. **Returns top 20** by confidence score
6. **Max execution time**: 300 seconds (enforced by `maxDuration = 300`)

---

## Example Response

```json
{
  "companies": [
    {
      "name": "TechCorp GmbH",
      "website": "https://techcorp.de",
      "description": "B2B SaaS platform for supply chain automation",
      "industry": "SaaS",
      "fundingOrRevenue": "raised €2.5M Series A",
      "usPresence": true,
      "founderOrCeoName": "Hans Mueller",
      "founderOrCeoEmail": "hans.mueller@techcorp.de",
      "emailVerified": true,
      "confidenceScore": 0.875,
      "sourceType": "SerpAPI"
    }
  ],
  "totalDiscovered": 142,
  "totalQualified": 15
}
```

---

## Rate Limiting / Abuse Prevention

**Currently**: None implemented.

**Recommended for production**:
- Add IP-based rate limiting (e.g., 1 request per 5 minutes per IP)
- Add authentication (API key or session)
- Consider moving to authenticated endpoint