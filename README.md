# HUNTLYST

<div align="center">

<img src="https://huntlyst2.vercel.app/huntlyst-logo.svg" alt="Huntlyst Logo" width="380" />

<p align="center">
  <strong>Find the companies worth knowing.</strong><br />
  <em>Autonomous company discovery, deep venture research, and decision-maker lead intelligence.</em>
</p>

[![Live Hosted App](https://img.shields.io/badge/Live%20Demo-huntlyst2.vercel.app-FF6B35?style=for-the-badge&logo=vercel&logoColor=white)](https://huntlyst2.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-2E7D32?style=for-the-badge)](LICENSE)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)

</div>

---

## 📌 Executive Summary

**Huntlyst** is an enterprise-grade autonomous company discovery engine built to identify, research, validate, and score high-conviction technology companies and executive decision-makers matching exact investment or corporate development mandates.

Unlike traditional commercial databases that rely on static aggregations, stale listings, and unverified scraping, Huntlyst operates in real-time as an autonomous agent:

> 🛡️ **Foundational Principle: Missing data is always better than invented data.**  
> Every prospective lead must be backed by verifiable web evidence, deterministic validation passes, and live DNS MX mail server verification. If an essential data point cannot be proven, the lead is discarded. Zero hallucinations. Zero mock data.

---

## 🚀 Live Product & Links

- **🌐 Live Hosted Application**: [https://huntlyst2.vercel.app](https://huntlyst2.vercel.app)

---

## ✨ Core Product Capabilities

### 1. 🧭 Official Vector Brand System & Animated Opening
- **Official Compass + H Logo**: A custom-engineered vector mark combining a classical serif "H", circular navigation track, four cardinal diamond points, and an orange directional needle slicing diagonally through the center.
- **2.4s Hand-Drawn Splash Screen**: A warm parchment opening experience with subtle world map routes and hand-drawn annotations (*"Start somewhere"*, *"More Founders. Bigger Tomorrows."*, *"Good leads leave evidence."*).
- **Session-Guarded**: Remembers session state via `sessionStorage` to greet first-time visitors without interrupting internal navigation. Automatically honors `prefers-reduced-motion`.

### 2. 🌍 Advanced Hunt Configuration & Geography Intelligence
- **200+ Countries Database**: Complete with flags, regional codes, tech hub profiles, and TLD matching.
- **11 Regional Presets**: Instant filtering across *Asia, Europe, South Asia, Southeast Asia, East Asia, Middle East, Oceania, Africa, North America, South America, and Global*.
- **Strict Country Exclusions**: Explicitly ban specific countries from search (e.g. *Asia excluding India*).
- **US Footprint Policy**: Four strict tiers (*Strictly None, Minimal/None, Limited Subsidiary, Any*).
- **Contradiction Detection**: Alerts users in real-time to contradictory search parameters before launching.
- **Saved Hunt Presets**: One-click selection for *TVB Evaluation Profile (Default)*, *Indian AI Hunt*, *Asian Fintech Hunt*, *European SaaS Hunt*, and *Global Cybersecurity Hunt*.

### 3. 🧠 "Describe Your Hunt" Natural Language Parser
- Transform free-form prompts like:
  > *"Find Indian AI startups with $1M–$5M funding and minimal US presence"*
- Instantly extracts target countries, demonyms (*"Indian"* → India, *"Chinese"* → China), target sectors, funding brackets, and US presence rules into a clean executable `HuntConfig`.

### 4. ⚡ Dedicated Animated Agent Research Experience
- **Logo as the Live Search Indicator**: During active discovery, the official logo becomes the focal research indicator with an animated sweeping compass needle, pulsing search radius, and orbiting source nodes.
- **Dynamic Real-Time SSE Telemetry**: Live stage status (*"Discovering new sources..."*, *"Researching companies..."*, *"Checking funding evidence..."*, *"Evaluating geography..."*, *"Finding founders..."*, *"Verifying professional emails..."*) streamed directly from the backend pipeline.
- **6-Stage Hand-Drawn Progress Path**:
  `Discovering` → `Researching` → `Validating` → `Finding Founders` → `Verifying Contacts` → `Almost There / Qualifying`
- **Real Metrics Grid**: Displays actual counts for *Sources Scanned, Candidates Found, Researched, Qualified, and Emails Verified*.

### 5. 🎯 Deterministic Multi-Dimension Hunt Score (0–100)
Every company is ranked across 5 rigorous pillars:
1. **Funding & Revenue Fit (20 pts)**: Verified against required bracket ($1M–$5M or customized range).
2. **Tech Platform Fit (20 pts)**: Confirmed proprietary software, API, B2B SaaS, or developer platform.
3. **Geography & US Presence Fit (20 pts)**: Verified non-US headquarters and strict compliance with US entity tolerance.
4. **Founder / Leadership Presence (20 pts)**: Verified CEO / Co-founder identity.
5. **Contact Deliverability (20 pts)**: Live DNS MX mail server verification.

### 6. 📬 Live DNS MX Email Verification
- Generates standard executive email permutations (`first@domain`, `first.last@domain`, `f.last@domain`).
- Executes live DNS lookups (`dns.promises.resolveMx`) to verify that the domain's mail exchange servers are active and ready to accept email traffic.

### 7. 📄 Executive Intelligence Dossiers & Multi-Format Exports
- **CSV Spreadsheet**: RFC-4180 standard spreadsheet with all qualification audit traces.
- **Executive PDF Report**: Built with `jspdf` and `jspdf-autotable`, featuring the official Huntlyst vector seal, summary KPI ribbons, and structured company breakdown.
- **Word Document (DOCX)**: Formatted executive document ready for investment committee presentations.

---

## 🏗️ System Architecture & Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 1. Hunt Config  │ ──▶ │ 2. Discovery    │ ──▶ │ 3. Extraction   │ ──▶ │ 4. Validation   │ ──▶ │ 5. Lead Dossier │
│    & NL Parser  │     │    Engine       │     │    & Analysis   │     │    & MX Verify  │     │    & Ranking    │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼                       ▼
  • 200+ Countries        • SerpAPI queries       • Cheerio DOM parser    • Programmatic          • 5-Pillar Score
  • 11 Region presets     • Web directory seed    • Structured entity       boundary checks         (0–100)
  • Natural Language        sources                 extraction via        • Zero US leaks         • CSV, PDF, DOCX
    demonym parsing       • Domain deduplication    Anthropic Claude      • Live DNS MX check       generation
```

### Module Guide

| File | Purpose |
|---|---|
| `components/HuntlystLogo.tsx` | Official Compass + H SVG vector logo with 8 animated states & 6 sizes |
| `components/SplashScreen.tsx` | 2.4s hand-drawn opening experience on warm parchment with smooth cross-fade |
| `components/HuntLoadingScreen.tsx` | Dedicated animated search radar screen with real-time SSE progress path |
| `components/HuntConfiguration.tsx` | 6-tab Research Desk (Where, What, Profile, Contact, Depth, Advanced) |
| `lib/geography.ts` | 200+ countries database, 11 region presets, and evidence-based detection |
| `lib/nlParser.ts` | Natural language heuristic and regex parser with demonym mapping |
| `lib/discovery.ts` | Multi-regional query builder and autonomous discovery pipeline |
| `lib/validation.ts` | Programmatic validation rules for funding, technology, and US presence |
| `lib/email.ts` | Leadership email permutation engine and live DNS MX validator |
| `lib/rank.ts` | Dynamic 5-pillar Hunt Score calculation engine |
| `lib/export.ts` | Multi-format dossier generator (CSV, executive PDF with seal, Word DOCX) |

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Design System**: Hand-drawn editorial paper aesthetic with Tailwind CSS, warm cream `#FAF6EE`, coral orange `#FF6B35`, and charcoal ink `#1E1B18`
- **Typography**: Outfit (Display), Caveat (Hand-drawn annotations), JetBrains Mono (Data & Telemetry)
- **AI Engine**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **Search & Ingestion**: SerpAPI, Cheerio, Node DNS
- **Document Exporting**: `jspdf`, `jspdf-autotable`, `docx`
- **Deployment & Hosting**: Vercel (Edge Network with global CDN)

---

## 💻 Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/mohitsah08/Huntlyst2.git
cd Huntlyst2
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# SerpAPI for autonomous search queries
SERPAPI_KEY=your_serpapi_key_here

# Anthropic Claude API for structured research extraction
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Abstract API for secondary mailbox verification
ABSTRACT_API_KEY=your_abstract_api_key_here
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Production Verification Checklist

All capabilities have been validated across 10 specific test scenarios:

- [x] **India Hunt**: Devtron, Emitrr, InPrime Infosystems, Portkey, Bytebeam *(all India HQs)*
- [x] **China Hunt**: Moonshot AI, Zhipu Tech *(Beijing / Shanghai HQs)*
- [x] **Asia Hunt**: Spanned Indian, Singaporean, and Japanese tech hubs
- [x] **Australia Hunt**: Kasada, Buildxact *(Sydney & Melbourne HQs)*
- [x] **South Africa Hunt**: Ozow, Naked Insurance *(Cape Town & Johannesburg HQs)*
- [x] **India + Singapore**: Discovered companies across both countries
- [x] **Asia Exclude India**: Finmo, Modus, Autify with zero Indian results
- [x] **Fintech India $1M–$5M**: InPrime Infosystems ($3.4M Series A Fintech)
- [x] **TVB Evaluation Profile**: Discovered 22 fully qualified companies matching all baseline criteria
- [x] **Natural Language Hunt**: Verified real-time parsing from *"Find Indian AI startups with $1M–$5M funding"*

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<div align="center">
  <strong>Huntlyst</strong> — <em>Find the companies worth knowing.</em><br />
  Designed & Engineered for High-Conviction Venture Discovery.
</div>
