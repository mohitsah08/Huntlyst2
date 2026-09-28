# Product Requirements Document (PRD)

## Problem Statement

TVB needs an autonomous agent that discovers tech companies matching a specific investment profile, validates them against strict criteria, finds and verifies founder/CEO contact emails, and returns a clean, ranked, exportable list of at least 15 qualifying companies.

## Goals

1. **Automate lead discovery** — Eliminate manual searching for companies in the target profile
2. **Ensure data quality** — Every returned lead must be fully verified against all criteria
3. **Provide actionable output** — Ranked list with verified emails, ready for outreach
4. **Maintain auditability** — Every field traces to a real source; no fabricated data

## Target Profile (ALL must be true)

| Criterion | Requirement |
|-----------|-------------|
| **Funding/Revenue** | Between $1,000,000 and $5,000,000 USD (inclusive) |
| **Business Model** | Tech-related platform: software, SaaS, marketplace, API, fintech, healthtech, edtech, proptech, insurtech, regtech, martech, hrtech, legaltech, agritech, foodtech, cleantech, biotech, medtech, AI/ML, data/analytics, cloud, devops, cybersecurity, blockchain, web3, IoT, robotics, automation, B2B enterprise software, developer tools, infrastructure |
| **Geography** | Minimal to no presence in the United States. Clear non-US evidence required (e.g., "based in Berlin", "headquartered in London", "serving European markets"). Undetermined = REJECT. |
| **Contact** | Verifiable CEO or co-founder name AND email address. Email must pass MX record check (and Abstract API if configured). |

## User Flow

1. User opens the web app
2. Clicks "Run Agent" button
3. System shows progress through 5 stages: Discovery → Extraction → Validation → Email Verification → Ranking
4. Results table renders with columns: Company, Website, Description, Industry, Funding/Revenue, US Presence, Founder/CEO, Email, Confidence, Source
5. User clicks "Export CSV" to download the data

## Success Metrics

- **Primary**: ≥ 15 qualifying companies returned in a single run
- **Quality**: 100% of returned emails have `emailVerified: true`
- **Accuracy**: 0% fabricated fields — every non-null field traces to source evidence
- **Performance**: Full pipeline completes within 5 minutes (300 seconds)
- **Reliability**: Pipeline completes without crashing even if individual API calls fail

## Non-Goals

- Real-time streaming progress updates (simulated progress is acceptable for v1)
- Integration with CRM or outreach tools
- Historical tracking of runs
- Multi-user authentication