# Data Sources

## 1. SerpAPI (Google Custom Search)

**Status**: Primary source (enabled when `SERPAPI_KEY` is set)

**Configuration**:
- Engine: `google`
- Results per query: 10 (`num=10`)
- Region: `gl=us`, `hl=en`
- Endpoint: `https://serpapi.com/search`

**Query Phrasings (5 rotating)**:
1. `startup raised seed funding tech platform 2025 2026`
2. `emerging tech company Series A non-US million funding`
3. `tech startup announces funding round million million`
4. `SaaS startup funding million dollar 2025 Europe Asia`
5. `marketplace platform startup raised funding non-US 2025`

**Rate Limits**:
- Free tier: 100 searches/month
- Paid tiers: Higher limits
- Each query = 1 search credit
- 5 queries per discovery round = 5 credits/round
- Max 3 rounds = 15 credits per full run

**Failure Behavior**:
- Individual query failures logged, other queries continue
- If all queries fail, source returns empty array
- If `SERPAPI_KEY` not set, source skipped entirely

**Output**: `organic_results` → `{ url, snippet }` array

---

## 2. Startup Directories (HTML Scraping)

**Status**: Fallback/secondary source (always enabled)

**Directories Scraped** (5 URLs):
1. `https://www.crunchbase.com/search/organizations/field/organizations/num_funding_rounds/1`
2. `https://angel.co/companies`
3. `https://www.f6s.com/startups`
4. `https://www.producthunt.com`
5. `https://www.betaspring.com/startups`

**Method**:
- `fetch()` with 10s timeout, custom User-Agent
- Regex extraction: `/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi`
- Filter: link text > 10 chars, contains company indicators
- Company indicators: `startup`, `company`, `inc`, `ltd`, `gmbh`, `technologies`, `labs`, `systems`, `solutions`, `platform`, `software`, `saas`, `app`, `ai`, `ml`, `tech`
- Max 20 results per directory

**Rate Limits**:
- No official API — subject to site ToS, rate limiting, blocking
- No authentication
- 10s timeout per request
- Failures return empty array (graceful degradation)

**Known Issues**:
- Many directories block automated scraping (Cloudflare, bot detection)
- Regex parsing is brittle — may miss links or capture noise
- Crunchbase, AngelList require login for full data
- ProductHunt is JavaScript-heavy (SSR may not work)

**Output**: `{ url, snippet }` array with `source: "StartupDirectories"`

---

## Source Selection Logic

```typescript
// In discoverCompanies():
const sources: DiscoverySource[] = [];

if (process.env.SERPAPI_KEY) {
  sources.push(new SerpApiSource(process.env.SERPAPI_KEY));
}

sources.push(new StartupDirectorySource());  // Always added

// Run in parallel via Promise.allSettled
```

## Recommendations for Production

1. **Add more SerpAPI query variations** — Current 5 may not cover all geographies/verticals
2. **Replace directory scraping with APIs** — Crunchbase, AngelList have official APIs (paid)
3. **Add regional search engines** — For better non-US coverage (e.g., local startup databases)
4. **Implement caching** — Avoid re-querying same terms within a session
5. **Monitor quota usage** — Alert when SerpAPI credits running low