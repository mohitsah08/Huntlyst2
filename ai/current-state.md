# AI Current State — TVB Huntlyst

- **Active Engine**: Next.js 14 App Router + Houston Autonomous Agent Runtime.
- **Pipeline Architecture**: 6-Stage Deterministic Pipeline (`DISCOVER`, `RESEARCH`, `VALIDATE`, `FIND_FOUNDERS`, `VERIFY_CONTACT`, `QUALIFY`).
- **External Research**: Fully modernized with `SourceInspectionManager` in `lib/sourceInspection.ts` utilizing Cheerio DOM reading and tier-ranked source sorting.
- **Verification Matrix**: 100/100 tests passing in `tests/regression-external-research.test.ts`.
