---
name: executive-discovery
title: Decision-Maker & Founder Discovery
description: Uncovers confirmed Founders, CEOs, and C-level executives for vetted companies with role verification and profile linkage.
version: 1
tags: ["enrichment", "founders", "executives", "decision-makers"]
category: enrichment
---

# Executive Discovery Skill

## Workflow
1. Accept validated company name, domain, and description.
2. Search corporate "About", "Team", and "Leadership" endpoints.
3. Cross-reference venture investment disclosures naming founders.
4. Extract primary executive details:
   - Full name
   - Specific verified title (Founder, Co-Founder, CEO, CTO)
   - Professional profile URL (LinkedIn, Crunchbase, etc.)
   - Source evidence snippet
5. Structure output into `DiscoveredPerson` contract.
