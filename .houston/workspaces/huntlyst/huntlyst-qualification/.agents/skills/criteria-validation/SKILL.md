---
name: criteria-validation
title: Target Profile Criteria Validation
description: Deterministically evaluates company attributes against investment theses, geographic boundaries, funding brackets, and industry taxonomy.
version: 1
tags: ["qualification", "scoring", "rules", "validation"]
category: qualification
---

# Criteria Validation Skill

## Workflow
1. Ingest enriched company dossier and active Target Profile.
2. Evaluate Geography Criterion:
   - Match detected headquarters against allowed countries and regions.
   - Enforce US presence strictness ('strictly_none', 'minimal_or_none', 'any').
3. Evaluate Funding / Revenue Criterion:
   - Normalize currency and parse funding figures.
   - Validate against [minFunding, maxFunding] window.
4. Evaluate Tech Platform Criterion:
   - Verify presence of proprietary software, cloud infrastructure, or platform features.
   - Reject service bureaus, brick-and-mortar storefronts, and local services.
5. Compute Hunt Score (0-100) and breakdown (Funding 20, Tech 20, Geo 20, Founder 20, Contact 20).
6. Emit structured `CriterionEvaluation` and final `verificationStatus`.
