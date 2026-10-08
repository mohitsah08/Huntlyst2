# Huntlyst Production Behavior Test: Deduplication Report

> **Execution Time**: 2026-10-02T11:20:14.306Z

## 1. Normalization & Matching Rules
- **Canonical Domain Extraction**: Removes `www.`, `http://`, trailing slashes, URL tracking parameters, and path segments.
- **Company Name Stemming**: Removes corporate suffixes (`Inc`, `LLC`, `Ltd`, `GmbH`, `Pte`).
- **Global Memory Store**: Enforces cross-session deduplication to guarantee no repeated leads inside the 30-day freshness window.

## 2. Test Accounting
- Total Discovered Across Runs: 55
- Historical Duplicates Suppressed: 1
- Final Unique Candidates: 54
