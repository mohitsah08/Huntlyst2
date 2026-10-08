# Huntlyst Acceptance Test: Automation Workflow Proof

> **Run ID**: `hunt-auto-1790939370449`
> **Scheduler**: `Hourly Autonomous Hunt Cron (0 * * * *)`
> **Timestamp**: `2026-10-02T11:09:15.442Z`

## 1. Execution Pipeline
1. **Saved Target Profile Loaded**: `DEFAULT_TVB_TARGET_PROFILE (Global $100K-$10M)`
2. **Scheduler Invoked**: Cron trigger fired at `2026-10-02T11:09:15.442Z`
3. **Multi-Strategy Discovery**: Ingested candidate batch from external queries
4. **Deduplication Engine**: Deduplicated canonical domains against internal database
5. **Fresh Research & DNS Verification**: Performed live HTTP GET and DNS MX checks
6. **Canonical Qualification**: Output qualified and rejected records with deterministic scores

## 2. Generated Run Artifact
- **Candidate Count**: 12 raw -> 10 unique
- **Artifact Path**: `/Users/onlymec/Documents/Project V/Huntlyst2/output/acceptance_automation_run_results.json`
