# Rebuilt Deterministic Discovery & Verification Workflow
Pipeline Stages:
1. INPUT: Ingest raw candidate leads (CSV, XLSX, JSON, TXT).
2. PARSE: Preserve all uploaded fields verbatim into source_data.raw_fields.
3. NORMALIZE: Structure source fields without fabricating missing values.
4. ENTITY RESOLUTION: Authoritative place query requiring Name + (Location / Address / Phone).
5. DISCOVER: Place ID and directory matching. No name-only matches.
6. RESEARCH: Map to 24 STANDARD PRESETS taxonomy (salons -> Other / Custom). Verify website via live DNS.
7. VALIDATE: Deterministic target profile criteria check (PASS / FAIL / UNKNOWN / CONTRADICTED).
8. FOUNDERS: Require evidence connecting person to company; otherwise null / UNKNOWN.
9. CONTACT: Separate RFC syntax, DNS MX validation, and founder association.
10. QUALIFY: Fail-closed qualification: REJECTED on fail/contradiction, REVIEW on missing evidence.
