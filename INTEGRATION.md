# Huntlyst ↔ Houston Integration Specification

This document details how **Huntlyst** (the user-facing lead discovery platform) and **Houston** (the open-source agent runtime infrastructure located in `houston-main/`) are integrated.

---

## 1. Architectural Philosophy

1. **Huntlyst is the Product**: The entire visual experience, user workflows, lead cards, filters, and persistence interfaces belong to Huntlyst.
2. **Houston is the Engine**: Houston provides the underlying workspace structure, agent manifests, skill declarations, tool interfaces, turn execution lifecycles, and observability.
3. **Invisible Infrastructure**: The user interacts only with Huntlyst. Houston operates as the execution framework under the hood, with no dual-brand confusion.

---

## 2. Houston Workspace Directory Structure

All agent definitions and skill instructions are housed under the standardized Houston workspace format:

```
.houston/workspaces/huntlyst/
├── huntlyst-discovery/
│   ├── agent.json               # Agent manifest (id, role, tools, skills, color)
│   ├── CLAUDE.md                # Houston persona prompt & execution directives
│   └── .agents/skills/
│       └── multi-strategy-discovery/
│           └── SKILL.md         # Discovery skill instructions & heuristics
├── huntlyst-research/
│   ├── agent.json
│   ├── CLAUDE.md
│   └── .agents/skills/
│       └── company-profiling/
│           └── SKILL.md
├── huntlyst-qualification/
│   ├── agent.json
│   ├── CLAUDE.md
│   └── .agents/skills/
│       └── criteria-validation/
│           └── SKILL.md
├── huntlyst-enrichment/
│   ├── agent.json
│   ├── CLAUDE.md
│   └── .agents/skills/
│       └── executive-discovery/
│           └── SKILL.md
└── huntlyst-verification/
    ├── agent.json
    ├── CLAUDE.md
    └── .agents/skills/
        └── email-mx-verification/
            └── SKILL.md
```

---

## 3. Runtime Integration Bridge

The integration boundary is managed by `lib/houston/runtimeBridge.ts` and `lib/houston/agentRegistry.ts`:

### Turn Lifecycle
1. **Turn Initialization**: `houstonBridge.executeTurn(agentId, sessionId, input, taskFn)` assigns an execution turn ID and logs start time.
2. **Context & Tool Recording**: During task execution, all external queries, scraper calls, and LLM completions are recorded as structured tool call records (`tool`, `input`, `output`, `durationMs`, `error`).
3. **Bounded Retries & Error Boundaries**: If a tool fails, the error is isolated to that candidate; the turn catches the error, completes the record, and prevents catastrophic pipeline failure.
4. **Zero-Secret Observability**: Logs and tool metadata are recorded in memory and emitted over SSE to Huntlyst without dumping API keys or private tokens.

---

## 4. Houston Agent Roster & Tool Permissions

| Agent ID | Houston Role | Assigned Skills | Sandboxed Tool Permissions |
| :--- | :--- | :--- | :--- |
| `huntlyst-discovery` | Autonomous Discovery Agent | `multi-strategy-discovery` | `search_web_duckduckgo`, `search_claude_intelligence`, `search_serpapi_google`, `fetch_funding_wires`, `browse_curated_directories` |
| `huntlyst-research` | Autonomous Company Research Agent | `company-profiling` | `scrape_company_website`, `extract_venture_signals`, `map_standard_industry` |
| `huntlyst-qualification` | Deterministic Qualification Agent | `criteria-validation` | `validate_geography_criteria`, `validate_funding_criteria`, `validate_tech_platform`, `calculate_hunt_score` |
| `huntlyst-enrichment` | Executive & Founder Discovery Agent | `executive-discovery` | `search_leadership_profiles`, `validate_executive_role`, `extract_linkedin_presence` |
| `huntlyst-verification` | Contact Verification & DNS MX Agent | `email-mx-verification` | `synthesize_email_patterns`, `verify_dns_mx_records`, `check_provider_status` |

---

## 5. Search Provider Abstraction (`ISearchProvider`)

Houston agents invoke search tools that implement the `ISearchProvider` interface in `lib/search/types.ts`:

- **DuckDuckGo Provider** (`lib/search/providers/DuckDuckGoProvider.ts`): Free open web scraping with pagination offset.
- **Claude Intelligence Provider** (`lib/search/providers/ClaudeIntelligenceProvider.ts`): LLM venture analysis with dynamic negative prompt constraints.
- **SerpApi Provider** (`lib/search/providers/SerpApiProvider.ts`): Google Organic API with geotargeting.
- **Funding Wires Provider** (`lib/search/providers/FundingWiresProvider.ts`): RSS feed scanner across venture journals.
- **Curated Venture Provider** (`lib/search/providers/CuratedVentureProvider.ts`): Rotating directory cursor over verified venture registry.

The `SearchManager` aggregates results, deduplicates across providers, handles individual provider failures gracefully, and caches responses.
