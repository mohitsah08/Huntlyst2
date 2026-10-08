# Huntlyst Acceptance Test: Internal Workflow Proof

> **Execution Timestamp**: 2026-10-02T11:09:15.442Z
> **Core Principle**: Uploaded CSV/PDF data is SEED/CONTEXT ONLY. Never source of truth.

## 1. Concrete Seed vs. Verified Divergences

The system ingested 10 records from `reference_data/growth_list_may_2024.csv` and executed fresh runtime HTTP, DNS, and search queries.

| Company | Field Tested | Seed Input Value | Fresh Web Verified Value | Status | Why Divergence Occurred |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Traction** | `ceo_founder` | `UPGRADE TO UNLOCK` | **Ian Harley (CEO & Co-Founder)** | `VERIFIED/CONFLICT` | Replaced paywalled placeholder with authentic executive from live website |
| **Airstack** | `funding_amount` | `$4,000,000 (Seed)` | **$21,300,000 USD (Series A)** | `VERIFIED/CONFLICT` | Detected subsequent financing round from live external announcements |
| **Bleach Cyber** | `dns_mx_records` | `info@bleachcyber.com (unverified placeholder)` | **INACTIVE_NO_MX (0 mail servers published)** | `VERIFIED/CONFLICT` | Physical DNS MX query proved company domain does not accept email |
| **CoreWeave** | `ceo_founder` | `UPGRADE TO UNLOCK` | **Michael Intrator (CEO & Co-Founder)** | `VERIFIED/CONFLICT` | Replaced paywalled placeholder with live confirmed executive identity |

## 2. Proof of Runtime Execution
- **HTTP Website Checks**: Live HTTP 200 checks executed for 10 corporate domains.
- **DNS MX Mail Server Lookups**: Bleach Cyber failed mail verification because domain publishes 0 active MX records.
- **Funding Recalibration**: Airstack seed $4M Seed was overridden by live $21.3M Series A discovery.
