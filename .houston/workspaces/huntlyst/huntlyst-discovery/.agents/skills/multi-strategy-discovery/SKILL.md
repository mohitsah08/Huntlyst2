---
name: multi-strategy-discovery
title: Multi-Strategy Company Discovery
description: Orchestrates multi-angle search query generation, source rotation, and pagination across venture search providers.
version: 1
tags: ["discovery", "search", "venture", "leads"]
category: discovery
---

# Multi-Strategy Discovery Skill

## Workflow
1. Parse Target Profile (industries, geographies, funding min/max, stages, business models, exclusions).
2. Generate diversified queries for the active strategy index (1 through 8).
3. Query the active search provider (Claude Intelligence, Open Web, SerpAPI, Funding Feeds, Curated Directories) with current pagination cursor.
4. Extract candidate entities: normalize website URLs and strip subdomains/paths to obtain canonical domains.
5. Filter against the previously-seen domain set and session deduplication index.
6. If yield is below threshold or duplicate ratio > 80%, trigger stagnation mutation:
   - Advance strategy pointer
   - Inject synonym keywords
   - Shift geographical angle
7. Yield verified candidate batch with provenance metadata.
