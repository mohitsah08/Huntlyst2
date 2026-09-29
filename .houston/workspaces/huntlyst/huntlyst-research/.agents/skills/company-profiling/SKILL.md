---
name: company-profiling
title: Evidence-Based Company Profiling
description: Extracts verified company metadata, funding history, headquarters, and tech categorization from public web evidence.
version: 1
tags: ["research", "profiling", "evidence", "enrichment"]
category: research
---

# Company Profiling Skill

## Workflow
1. Accept candidate company name and canonical website URL.
2. Fetch company landing page, about page, and venture news snippets using safe HTTP/scraper tools.
3. Parse and extract key attributes:
   - Canonical name & legal entity
   - Industry & business model description
   - Funding history (total raised, latest round, currency, date, investors)
   - Headquarters location (country, city, region)
   - US presence signals (offices, incorporation, operations)
4. Record field evidence with timestamps and source URLs.
5. Return enriched company dossier for downstream qualification.
