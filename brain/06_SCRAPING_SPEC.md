# Scraping Specification

## HTML Fetching (`lib/extraction.ts::fetchPageText`)

**Method**: Native `fetch()` with options:
```typescript
{
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; TVB-Company-Discovery/1.0; +https://tvb-agent.example.com)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  signal: AbortSignal.timeout(15000),  // 15 second timeout
}
```

**Validation**:
- Checks `response.ok` (2xx status)
- Verifies `content-type` includes `text/html`
- Returns `null` on any failure (non-200, timeout, wrong content type, network error)

**Error Handling**: Logs warning with URL and error, returns `null` — candidate dropped silently.

---

## Text Extraction (`lib/extraction.ts::extractTextFromHtml`)

**Library**: Cheerio 1.0 (server-side jQuery-like)

**Elements Removed** (via `.remove()`):
- `script`, `style` — code and stylesheets
- `nav`, `footer`, `header`, `aside` — layout chrome
- `noscript`, `iframe` — fallback/embedded content
- `.ads`, `.advertisement`, `.cookie-banner`, `.newsletter` — common ad/tracking classes

**Content Selection Priority** (first match wins):
1. `main`
2. `article`
3. `[role="main"]`
4. `.content`
5. `#content`
6. `.main`
7. `body` (fallback)

**Text Cleaning**:
```typescript
text
  .replace(/\s+/g, ' ')      // Collapse whitespace
  .replace(/\n+/g, '\n')     // Collapse newlines
  .trim()
  .slice(0, 20000)           // Hard cap at 20k chars
```

**Output**: Plain text string, max 20,000 characters.

---

## LLM Prompting

**Model**: `claude-sonnet-4-6` (via Anthropic SDK)

**Parameters**:
- `max_tokens: 1024`
- `temperature: 0` (deterministic)
- `system: SYSTEM_PROMPT` (strict JSON-only instructions)

**User Prompt Template**:
```
Source URL: {url}

Page Text:
{text.slice(0, 15000)}
```

**System Prompt Key Rules**:
- Return ONLY valid JSON, no markdown, no preamble
- Exact shape with 6 fields (all nullable)
- "If a field cannot be confidently determined from the text, return null. Never guess."

---

## Response Parsing (`parseLLMResponse`)

**Handling**:
1. Strip ````json` or ````` fences if present
2. `JSON.parse()`
3. Validate all 6 required fields exist in parsed object
4. Return typed `ExtractedCompanyData` or `null` on any failure

**Failure Modes**:
- Malformed JSON → `null`, logged
- Missing fields → `null`, logged
- Empty response → `null`, logged
- All failures → candidate dropped

---

## Known Failure Patterns

| Site Type | Issue | Current Handling |
|-----------|-------|------------------|
| SPA / React apps | Content loaded via JS, not in initial HTML | Cheerio sees empty/no content → returns `null` |
| Cloudflare-protected | Challenge page returned instead of content | Non-HTML or challenge text → `null` |
| Login-walled | Redirect to login, no company info | `null` |
| Heavy JS frameworks | Minimal text in initial HTML | `null` if < 500 chars |
| Non-English | Prompt in English, may miss localized content | LLM may still extract, but quality varies |
| PDF/downloads | `content-type` not HTML | Rejected early in `fetchPageText` |

---

## Limits & Thresholds

| Limit | Value | Location |
|-------|-------|----------|
| Page fetch timeout | 15s | `fetchPageText` |
| Min page text length | 500 chars | `extractCompanyData` |
| Max text to LLM | 15,000 chars | `USER_PROMPT_TEMPLATE` |
| Max extracted text | 20,000 chars | `extractTextFromHtml` |
| LLM max tokens | 1,024 | `extractCompanyData` |
| Extraction concurrency | 5 | `extractAllCandidates` |

---

## Improvements Needed

- [ ] Add retry logic with exponential backoff for failed fetches
- [ ] Consider headless browser (Playwright) for JS-heavy sites
- [ ] Add content-type detection for PDF/other formats
- [ ] Implement robots.txt respect (currently not checked)
- [ ] Add request deduplication within a run (same URL fetched multiple times)