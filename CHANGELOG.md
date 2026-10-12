# TVB Huntlyst — Changelog

All notable changes to the TVB Huntlyst platform are documented in this file.

## [2.3.0] - 2026-10-12

### Added
- **Independent Dual-Workflow Architecture**: Rebuilt External workflow into two strictly decoupled stages:
  1. **Company Research & Scraping (`/api/research`)**: Discovers and scrapes official homepage, About, Leadership, Contact, and Press subpages using Firecrawl. Extracts identity, geography, leadership, funding, contacts, and field-level evidence. Persists `CompanyResearchProfile`.
  2. **Target-Based Verification & Qualification (`/api/verify`)**: Evaluates already-researched companies against independent `TargetCriteria` (`/api/target-profile`). Pure deterministic evaluation with zero network requests or re-scraping.
- **Evidence Explorer UI**: Complete field-level source transparency with direct source links, quotes, retrieval timestamps, and confidence tiers.
- **Input Guardrails & Anti-Hallucination**:
  - Rejects arbitrary prompts, deployment messages, and generic tasks with clear user feedback.
  - No synthetic `.com` domains generated from company names.
  - No guessed email patterns; unverified emails remain `UNKNOWN`.
  - Missing facts (e.g. undisclosed funding, unknown geography) strictly produce `UNKNOWN` instead of `PASS`.
- **Target Criteria Independence**: Modify funding bounds ($5M–$6M), geography, and industry without triggering costly web scraping. Re-verifies in milliseconds.
- **Comprehensive Regression Suite**: 38 automated tests covering input rejection, Firecrawl error resilience, deterministic criteria qualification, batch handling, and golden URL testing (`https://www.blaize.com/`).

## [2.2.0] - 2026-10-12

### Added
- **Firecrawl Web Research Integration**: Replaced legacy web search with Firecrawl v2 API.


### Added
- **Full External Research Engine Overhaul**: Rebuilt around `SEARCH → SOURCE FETCH → SOURCE READ → STRUCTURED EXTRACTION → CROSS-SOURCE VERIFICATION → DOSSIER → QUALIFICATION`.
- **Deep Source Reading via Cheerio**: Replaced snippet regex matching with full-text inspection of crawled official pages, press releases, and Wikipedia API revisions.
- **Role-Aware Leadership Extraction**: Distinct classification for Current CEO, Former CEO, Founders, and Co-Founders.
- **Chronological Funding Timeline**: Multi-round funding records separating total disclosed venture capital from latest round instruments and dates.
- **Canonical Domain Isolation**: Inspected source cache scoped per candidate domain to eliminate cross-company evidence pollution.
- **100/100 Regression Test Suite**: Automated verification across 28 comprehensive test scenarios including Mindfuel, PharmEasy, and Traction Ag golden tests.

### Fixed
- **Snippet Hallucination Elimination**: Fixed Mindfuel CEO resolving to "and Senior Business" by eliminating unstructured snippet parsing.
- **PharmEasy Entity Resolution & Industry Protection**: Accurately mapped to Healthcare & Pharma with complete $1.5B funding timeline and official LinkedIn surfacing.
- **Rejection Dossier Preservation**: Ensured failed/rejected companies retain complete, evidence-backed research dossiers without premature pipeline termination.

## [2.0.0] - 2026-10-06

### Added
- **Houston Open-Source Agent Runtime Integration**: Embedded Houston autonomous agent orchestration supporting 5 specialized agents (`huntlyst-discovery`, `huntlyst-research`, `huntlyst-qualification`, `huntlyst-enrichment`, `huntlyst-verification`).
- **Internal Offline Lead Processor**: Upload and batch analyze CSV, XLSX, PDF, DOCX, and TXT files without performing unwanted live web queries.
- **Target Profile Customization Engine**: Centralized investment mandate editor enforcing strict deterministic bounds for funding, geography, sectors, and roles.
