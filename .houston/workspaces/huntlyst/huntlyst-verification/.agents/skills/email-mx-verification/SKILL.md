---
name: email-mx-verification
title: Professional Email & DNS MX Verification
description: Synthesizes professional email candidates, performs live DNS MX record lookups, and categorizes deliverability status.
version: 1
tags: ["verification", "email", "mx", "dns", "deliverability"]
category: verification
---

# Email MX Verification Skill

## Workflow
1. Accept verified person name (first, last) and company canonical domain.
2. Synthesize standard B2B patterns:
   - `first@domain`
   - `first.last@domain`
   - `f.last@domain`
   - `firstlast@domain`
3. Resolve DNS Mail Exchanger (MX) records for company domain:
   - If MX records exist (Google Workspace, Microsoft 365, Proton, etc.), mark DNS verified.
   - If MX records do not exist or NXDOMAIN, mark status `invalid`.
4. If external verification API configured (e.g. Abstract API), query endpoint with timeout guard.
5. Classify final deliverability: `valid`, `risky`, `invalid`, `catch-all`, `unavailable`, `unknown`.
6. Return `EmailVerificationResult` with MX host evidence snippet.
