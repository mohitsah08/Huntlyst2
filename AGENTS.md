# Huntlyst2 Agent Roster & Skill Manifests

This document defines the 5 core autonomous agents operating within the Huntlyst workspace on the Houston runtime.

---

## 1. Huntlyst Discovery Agent (`huntlyst-discovery`)

- **Role**: Target-driven query formulation and multi-source candidate discovery.
- **Houston Workspace**: `.houston/workspaces/huntlyst/huntlyst-discovery/`
- **Assigned Skill**: `multi-strategy-discovery` (`.agents/skills/multi-strategy-discovery/SKILL.md`)
- **Assigned Tools**:
  - `search_web_duckduckgo`: Open web discovery with pagination offset.
  - `search_claude_intelligence`: Semantic venture queries with dynamic exclusions.
  - `search_serpapi_google`: Targeted Google Organic Search.
  - `fetch_funding_wires`: RSS venture funding dispatches.
  - `browse_curated_directories`: Rotating cursor over global verified tech directory.
- **Input**: `TargetProfile` (geography, funding, sectors, business models, targetCount).
- **Output**: Array of raw candidate URLs and company names with source provenance.
- **Failure Mode Mitigation**: Rotates through the 8 query strategies and mutates query parameters when stagnation is detected.

---

## 2. Huntlyst Research Agent (`huntlyst-research`)

- **Role**: Deep web scraping, venture signal extraction, and company profiling.
- **Houston Workspace**: `.houston/workspaces/huntlyst/huntlyst-research/`
- **Assigned Skill**: `company-profiling` (`.agents/skills/company-profiling/SKILL.md`)
- **Assigned Tools**:
  - `scrape_company_website`: Fetches and cleans homepage/about page content.
  - `extract_venture_signals`: Identifies financing rounds, investor mentions, and headcount.
  - `map_standard_industry`: Standardizes taxonomy into B2B SaaS, FinTech, AI/ML, etc.
- **Input**: Candidate domain or URL.
- **Output**: Structured `CompanyProfile` (legal name, headquarters, description, estimated funding, tech signals, source evidence snippets).
- **Rule**: Never hallucinate facts; store exact text snippets as evidence.

---

## 3. Huntlyst Qualification Agent (`huntlyst-qualification`)

- **Role**: Deterministic criteria evaluation against target investment parameters.
- **Houston Workspace**: `.houston/workspaces/huntlyst/huntlyst-qualification/`
- **Assigned Skill**: `criteria-validation` (`.agents/skills/criteria-validation/SKILL.md`)
- **Assigned Tools**:
  - `validate_geography_criteria`: Confirms non-US headquarters and target country matches.
  - `validate_funding_criteria`: Checks funding falls within specified min/max bounds.
  - `validate_tech_platform`: Verifies genuine proprietary technology presence.
  - `calculate_hunt_score`: Computes deterministic composite qualification score (0-100).
- **Input**: `CompanyProfile` + `TargetProfile`.
- **Output**: `MATCH`, `PARTIAL_MATCH`, or `REJECTED` with explicit qualification reasons.
- **Rule**: Code handles deterministic constraints (revenue, location); LLM handles semantic alignment.

---

## 4. Huntlyst Enrichment Agent (`huntlyst-enrichment`)

- **Role**: Active founder, co-founder, and CEO discovery.
- **Houston Workspace**: `.houston/workspaces/huntlyst/huntlyst-enrichment/`
- **Assigned Skill**: `executive-discovery` (`.agents/skills/executive-discovery/SKILL.md`)
- **Assigned Tools**:
  - `search_leadership_profiles`: Web and directory queries for founders and executives.
  - `validate_executive_role`: Checks current status vs former employee records.
  - `extract_linkedin_presence`: Matches authentic LinkedIn URL without name collision.
- **Input**: Qualified company record + website URL.
- **Output**: Verified executive name, verified role, confidence score, and source URL.
- **Anti-Hallucination Guardrails**: Rejects names that only appear in blog comments, investor advisory lists, or unrelated companies with similar names.

---

## 5. Huntlyst Verification Agent (`huntlyst-verification`)

- **Role**: Executive contact synthesis and DNS MX deliverability verification.
- **Houston Workspace**: `.houston/workspaces/huntlyst/huntlyst-verification/`
- **Assigned Skill**: `email-mx-verification` (`.agents/skills/email-mx-verification/SKILL.md`)
- **Assigned Tools**:
  - `synthesize_email_patterns`: Derives corporate patterns (`{first}@{domain}`, `{f}{last}@{domain}`).
  - `verify_dns_mx_records`: Direct DNS lookup for valid MX mail server records.
  - `check_provider_status`: Real-time SMTP deliverability check via Abstract/external APIs.
- **Input**: Executive name + canonical domain.
- **Output**: Standard deliverability status (`valid`, `invalid`, `risky`, `catch-all`, `unavailable`, `unknown`).
- **Rule**: Never label an email verified unless mail exchange DNS records are physically confirmed.
