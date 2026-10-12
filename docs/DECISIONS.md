# Architectural Decisions (ADR) — TVB Huntlyst

## ADR-001: Cheerio Source Reading Over Snippet Regex Parsing
- **Decision**: All factual attributes extracted in the External research engine must be verified by reading crawled HTML documents via Cheerio.
- **Rationale**: Search snippets frequently match unrelated mentions, executive surveys, or third-party advertisements, causing erroneous entity hallucinations.

## ADR-002: Preservation of Rejected Candidate Dossiers
- **Decision**: Pipeline stages must never abort when an early criterion (e.g. geography or funding) fails.
- **Rationale**: Users require full visibility into why a company failed and need the complete dossier for auditability.

## ADR-003: Deterministic Code Over Stochastic Qualification
- **Decision**: Qualification criteria evaluation ($1M–$5M, Non-US HQ, Tech Platform) must be executed deterministically in code rather than via unconstrained LLM prompts.
- **Rationale**: Guarantees repeatable, auditable qualification decisions with explicit failure reason codes.
