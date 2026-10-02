# Huntlyst Acceptance Test: External Workflow Proof

> **Execution Timestamp**: 2026-10-02T11:09:15.442Z
> **Target Profile Applied**: Profile 1 (Global SaaS: $100K–$10M, CEO required, CEO email disabled)

## 1. Discovered Candidate Log
- **Query Dispatched**: `B2B SaaS Series A venture capital funding announcement 2024`
- **Candidate Discovered**: **Synthesia Ltd** (https://www.synthesia.io)
- **Research Sources Checked**:
  - https://www.synthesia.io
- https://www.synthesia.io/about
- dns://synthesia.io
- **Verified Values**:
  - Funding: $90,000,000 USD
  - CEO: Victor Riparbelli (CEO & Co-Founder)
  - Geography: United Kingdom
  - DNS MX: Active (aspmx.l.google.com)

## 2. Canonical Target Profile Evaluation
- **Qualification Verdict**: **Rejected**
- **Match Score**: **52%**
- **Exact Rationale**: Funding $90,000,000 USD exceeds configured maximum $10,000,000 USD

**Architectural Proof**: Both Internal candidates and External candidates are processed by `evaluateCanonicalTargetQualification()` without separate rules.
