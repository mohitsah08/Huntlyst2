# UI Specification

## Page Layout (`app/page.tsx`)

### Header Section
- **Title**: "TVB Company Discovery Agent" (text-3xl, bold)
- **Subtitle**: Explains target profile criteria in one sentence

### Control Section (Card)
**Run Agent Button**:
- Default: "Run Agent" (blue-600, white text)
- Disabled/Loading: "Running Agent..." (opacity-50, cursor-not-allowed)
- Full width on mobile, auto width on desktop

**Export CSV Button**:
- Only visible when results exist
- Gray-100 background, gray-700 text
- Triggers client-side CSV download

**Progress Indicator** (only during run):
- Stage message (e.g., "Starting pipeline...")
- Progress bar: 5 segments, fills as `stage / 5 * 100%`
- Stage labels below bar: Discovery, Extraction, Validation, Email Verification, Ranking
- Completed stages: blue-600, pending: gray-300

**Error Display** (if error):
- Red-50 background, red-200 border, red-700 text
- Shows error message from API

### Results Table (Card, only when results exist)
**Table Header**:
- Company | Website | Description | Industry | Funding/Revenue | US Presence | Founder/CEO | Email | Confidence | Source

**Table Rows** (alternating white/gray-50):
- **Company**: name (font-medium, gray-900)
- **Website**: clickable link (blue-600, truncate, max-w-xs, opens in new tab)
- **Description**: truncate, max-w-md, "—" if null
- **Industry**: text, "—" if null
- **Funding/Revenue**: font-mono, "—" if null
- **US Presence**: 
  - `true` → "Non-US ✓" (green-600)
  - `false` → "US Presence" (red-600)
  - `null` → "Unknown" (gray-400)
- **Founder/CEO**: name, "—" if null
- **Email**:
  - No email → "Not found" (gray-400)
  - Unverified → email in yellow-600
  - Verified → email in green-600 + "Verified" badge (green-100/green-700)
- **Confidence**: font-mono, percentage (0–100%)
  - ≥75% → green-600
  - ≥50% → yellow-600
  - <50% → red-600
- **Source**: gray-500 (SerpAPI or StartupDirectories)

**Empty State**: "No companies met all criteria. Try running again or check API keys."

### Footer
- Pipeline description: "Pipeline: Discovery → Extraction → Validation → Email Verification → Ranking"
- Criteria reminder: "Criteria: $1M–$5M funding • Tech platform • Non-US • Verified founder/CEO email"

---

## CSV Export (`handleExportCsv`)

**Trigger**: "Export CSV" button click (only enabled when results exist)

**Column Order** (11 columns):
1. Company
2. Website
3. Description
4. Industry
5. Funding/Revenue
6. US Presence
7. Founder/CEO
8. Email
9. Email Verified
10. Confidence Score
11. Source

**Value Transformations**:
- Strings: escaped for CSV (quotes doubled, wrapped in quotes if contains comma/quote/newline)
- `usPresence`: "Non-US" / "US" / "Unknown"
- `emailVerified`: "Yes" / "No"
- `confidenceScore`: "XX.X%"

**Filename**: `tvb-companies-YYYY-MM-DD.csv`

**Implementation**: Client-side Blob creation, `URL.createObjectURL()`, anchor click download.

---

## Progress Simulation

**Current Implementation**: Simulated (not real-time)
- Frontend calls API, waits for full response
- Then sets progress to "Complete!" (stage 5)
- No Server-Sent Events or WebSocket streaming

**Stages Defined** (constant `STAGES`):
1. Discovery — "Finding candidate companies..."
2. Extraction — "Extracting company data from pages..."
3. Validation — "Validating against criteria..."
4. Email Verification — "Finding and verifying founder emails..."
5. Ranking — "Deduplicating and ranking results..."

---

## Responsive Behavior

- Mobile-first: buttons stack vertically (flex-col)
- Desktop: buttons side-by-side (sm:flex-row)
- Table: horizontal scroll on overflow (overflow-x-auto)
- Max width: 7xl (1280px) centered

---

## Accessibility

- Semantic HTML: `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`
- Links: `rel="noopener noreferrer"` on external links
- Color contrast: Tailwind default colors meet WCAG AA
- Focus states: Inherited from Tailwind (ring on focus)
- No ARIA labels added explicitly (rely on native semantics)