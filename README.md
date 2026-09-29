# HUNTLYST2 — Production AI Lead Discovery Platform

<div align="center">

<img src="https://huntlyst2.vercel.app/huntlyst-logo.svg" alt="Huntlyst Logo" width="380" />

<p align="center">
  <strong>Find the companies worth knowing.</strong><br />
  <em>Autonomous venture discovery, deep company research, and verified executive lead intelligence.</em><br />
  <em>Powered by Houston's Open-Source Agent Execution Runtime.</em>
</p>

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![Houston Agent Runtime](https://img.shields.io/badge/Houston-Agent%20Workspace-3B82F6?style=for-the-badge)](./INTEGRATION.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-2E7D32?style=for-the-badge)](LICENSE)

</div>

---

## 📌 Executive Summary

**Huntlyst2** is an enterprise-grade autonomous company discovery platform that transforms vague venture mandates into high-conviction, verified leads. 

Huntlyst embeds **Houston**'s open-source agent infrastructure (`houston-main/`) as its invisible agent orchestration runtime. While Houston powers the agent workspaces, skills, tool sandboxes, and turn lifecycles under the hood, Huntlyst remains the sole, unified user experience.

> 🛡️ **The Evidence-First Principle: Missing data is always better than invented data.**  
> Every discovered lead is backed by verifiable web provenance, deterministic criteria evaluation, and physical DNS MX mail exchange verification. If an essential data point cannot be confirmed, the lead is rejected. Zero hallucinations. Zero mock data.

---

## 🧠 Architectural Overview

Huntlyst2 separates domain product responsibilities from agent execution:

```
USER
  ↓
HUNTLYST UI (Next.js 14 Client — Pure Huntlyst experience)
  ↓
HUNTLYST API (/api/run-agent SSE & /api/sessions Persistence)
  ↓
DISCOVERY ENGINE (Deterministic Pipeline Orchestration)
  ↓
HOUSTON AGENT RUNTIME BRIDGE (.houston/workspaces/huntlyst)
  ↓
HOUSTON AGENT ROSTER (Discovery, Research, Qualification, Enrichment, Verification)
  ↓
SEARCH & DATA MESH (DuckDuckGo, Claude, SerpApi, Funding Wires, Curated Registry)
  ↓
DEDUPLICATION & MEMORY (.huntlyst/data/huntlyst_store.json)
  ↓
HUNTLYST UI (Live SSE streaming, Lead Cards, Confidence Scores, Saved Leads)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [INTEGRATION.md](./INTEGRATION.md) for full architectural specifications.

---

## 🚀 The Repeat-Search Problem: Solved

### The Problem
Previously, repeated discovery searches (e.g. *"Find 50 SaaS companies in Europe"*) repeatedly returned the same small set of companies due to static query formulation, single-source reliance, and volatile in-memory deduplication.

### The Architectural Solution
1. **8 Query Diversification Strategies**:
   - **Strategy 1: Direct Industry + Geography**: Exact vertical keywords mapped to target nations/regions.
   - **Strategy 2: Venture Capital & Funding Signals**: Target sectors combined with financing terms (`Seed`, `Series A`, `funding round`).
   - **Strategy 3: Hiring & Scale Signals**: Growth markers (`careers`, `we are hiring`, `open positions`).
   - **Strategy 4: Platform Architecture & Technology Signals**: Technical breadcrumbs (`API documentation`, `developer portal`, `SDK`).
   - **Strategy 5: Taxonomy Expansion & Synonyms**: Automated expansion using vertical synonym dictionaries (e.g., `SaaS` -> `cloud software`, `enterprise workflow`).
   - **Strategy 6: Ecosystem Directories & Registries**: High-density ecosystem sites (`site:dealroom.co`, `site:pitchbook.com`, `site:crunchbase.com`).
   - **Strategy 7: Venture News & Editorial Dispatches**: Regional journalism dispatches (`site:eu-startups.com`, `site:tech.eu`, `site:sifted.eu`).
   - **Strategy 8: Country-Specific Ecosystem Focus**: Iterative geographic drilling focusing on individual focus nations and regional hubs.
2. **Multi-Source Search Mesh (`ISearchProvider`)**:
   Queries are fanned out concurrently across DuckDuckGo Open Web, Claude Venture Intelligence, SerpApi Google Organic, Venture Funding Wires RSS, and Curated Venture Directory.
3. **Multi-Level Deduplication Engine**:
   - Canonical root domain extraction (`https://www.subdomain.acmecorp.io/path` -> `acmecorp.io`, supporting ccTLDs like `.co.uk`).
   - Corporate suffix stripping (`Acme Technologies LLC` -> `acme`).
   - Composite SHA-256 fingerprinting matching across variations.
4. **Stagnation Detection & Automatic Query Mutation**:
   The engine automatically detects when consecutive rounds return >80% duplicate or 0 new candidates, and rotates strategy, mutates keywords, and advances pagination offsets.
5. **Persistent Cross-Session Memory**:
   Persisted to `.huntlyst/data/huntlyst_store.json`. Re-running queries across days or browser reloads immediately recognizes and filters previously examined companies.

---

## 🤖 Houston Agent Roster

All agent definitions and skill instructions are housed under `.houston/workspaces/huntlyst/`:

| Agent ID | Role | Houston Skill | Sandboxed Tools |
| :--- | :--- | :--- | :--- |
| `huntlyst-discovery` | Autonomous Discovery Agent | `multi-strategy-discovery` | `search_web_duckduckgo`, `search_claude_intelligence`, `search_serpapi_google`, `fetch_funding_wires`, `browse_curated_directories` |
| `huntlyst-research` | Company Profiling Agent | `company-profiling` | `scrape_company_website`, `extract_venture_signals`, `map_standard_industry` |
| `huntlyst-qualification` | Qualification Agent | `criteria-validation` | `validate_geography_criteria`, `validate_funding_criteria`, `validate_tech_platform`, `calculate_hunt_score` |
| `huntlyst-enrichment` | Executive & Founder Discovery Agent | `executive-discovery` | `search_leadership_profiles`, `validate_executive_role`, `extract_linkedin_presence` |
| `huntlyst-verification` | Contact Verification Agent | `email-mx-verification` | `synthesize_email_patterns`, `verify_dns_mx_records`, `check_provider_status` |

See [AGENTS.md](./AGENTS.md) for complete details.

---

## 🛠️ Local Development & Setup

### Prerequisites
- Node.js 18+ (tested on Node v20/v22)
- npm or pnpm

### 1. Installation
```bash
git clone https://github.com/mohitsah08/Huntlyst2.git
cd Huntlyst2
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Configure your keys:
```env
# Required for Claude Venture Intelligence queries
ANTHROPIC_API_KEY=your_key_here

# Optional: For Google Organic Search (100 free searches/month)
SERPAPI_KEY=your_key_here

# Optional: For real-time email deliverability validation
ABSTRACT_API_KEY=your_key_here
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Testing

### Run Core Systems Test Suite
To verify deduplication, the 8-strategy QueryPlanner, stagnation auto-mutation, disk persistence, and Houston agent execution:
```bash
npx -y tsx scratch/test-core-systems.ts
```

### Run TypeScript Check
```bash
npx tsc --noEmit
```

### Run Production Build
```bash
npm run build
```

---

## 🔒 Security & Privacy Guardrails

- **Zero Hardcoded Secrets**: All API tokens are loaded exclusively via server-side environment variables.
- **Client-Safe Bundling**: Webpack resolve fallbacks prevent Node built-ins (`fs`, `path`, `crypto`) from leaking into browser code.
- **Namesake & Former Employee Protection**: Leadership extraction requires strict corroboration between company domain, role titles, and provenance URLs.
- **DNS MX Deliverability Categorization**: Emails are categorized into standard deliverability states (`valid`, `invalid`, `risky`, `catch-all`, `unavailable`, `unknown`) rather than blindly trusted.

---

## 📄 License

MIT License. Built with ❤️ by the Huntlyst engineering team.
