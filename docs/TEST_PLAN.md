# Test Plan & Verification Strategy — TVB Huntlyst

## 1. Test Matrix
The test suite validates deterministic constraints, pipeline stage execution, and entity resolution:

1. **Unit & Function Tests**:
   - URL canonicalization and domain extraction (`lib/deduplication.ts`).
   - Standard industry preset normalization (`lib/sourceInspection.ts`).
   - Funding currency and round parsing (`lib/discoveryPipeline.ts`).
   - DNS MX mail exchanger resolution (`lib/email.ts`).
2. **Regression Scenarios (Scenarios 1–28)**:
   - Scenarios 1–7: Pipeline stages and qualification scoring.
   - Scenarios 8–11: Anti-guessing email safeguards, real LinkedIn URLs, and leadership separation.
   - Scenarios 12–15: Rejected dossiers, complete audits, and required criteria gating.
   - Scenarios 16–25: Field coverage matrix, custom targets, and entity disambiguation.
   - Scenario 26: Mindfuel golden regression (CEO Nadiem von Heydebrand, $4.1M funding, Munich).
   - Scenario 27: PharmEasy golden regression (Healthcare & Pharma, $1.5B timeline, LinkedIn surfaced).
   - Scenario 28: Traction Ag golden regression (Current CEO Dustin Sapp, Former CEO Ian Harley).

## 2. Test Execution
```bash
NODE_PATH="./node_modules" npx tsx --tsconfig ./tsconfig.json ./tests/regression-external-research.test.ts
```
Target: 100% pass rate before committing or deploying.
