# Product Requirements Document (PRD) — TVB Huntlyst

## 1. Product Vision
TVB Huntlyst is an autonomous venture intelligence platform designed to eliminate the manual, low-conviction overhead of sourcing early-stage technology companies. Huntlyst operates on an Evidence-First mandate: missing data is strictly preferred over fabricated or hallucinated data.

## 2. Workflows
1. **External Sourcing (Target Mandate & Direct URLs)**:
   - Takes investment mandates (geography, funding range, tech platforms) or specific candidate domains/URLs.
   - Executes multi-source crawling, deep Cheerio DOM parsing, and structured extraction.
   - Outputs verified dossiers with complete field audits, evidence snippets, and qualification verdicts.
2. **Internal Document Auditing (Offline Batch)**:
   - Ingests uploaded CSV, XLSX, PDF, DOCX, and TXT venture pitch files.
   - Evaluates internal documents offline with zero unauthorized web requests.
   - Generates unified qualification scores and formatted lead packages.
3. **Automated Venture Monitoring**:
   - Executes persistent recurring scans against verified funding dispatches, RSS wires, and technology directories.

## 3. Strict Qualification Bounds
- **Venture Funding**: Disclosed capital between $1.0M and $5.0M (Seed / Series A).
- **Geography**: Strict non-US headquarters requirement (e.g. UK, Germany, France, India, Canada).
- **Proprietary Technology**: Genuine platform/product software, excluding services agencies and consultancies.
- **Decision Makers**: Direct verified identity of executive founders and active CEOs.
