# TVB Huntlyst — Changelog

All notable changes to the TVB Huntlyst platform are documented in this file.

## [2.1.0] - 2026-10-08

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
