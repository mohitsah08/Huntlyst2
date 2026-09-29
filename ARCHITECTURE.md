# Huntlyst2 Architecture & System Design

Huntlyst2 is a production-grade, venture intelligence and autonomous lead discovery platform that embeds the open-source **Houston** agent execution and skill runtime as its invisible orchestration infrastructure.

---

## 1. High-Level System Architecture

```mermaid
graph TD
    User([User / Web Browser])
    
    subgraph "Huntlyst Presentation Layer (Next.js 14)"
        UI[Huntlyst UI Dashboard]
        Config[Target Profile & Config Modal]
        LiveStream[SSE Live Progress & Telemetry]
        LeadCards[Lead Records & Evidence Inspector]
    end

    subgraph "Huntlyst Application Layer"
        APIRoute["/api/run-agent (SSE Endpoint)"]
        SessionRoute["/api/sessions (Persistence API)"]
        DiscoveryEngine[DiscoveryEngine Master Orchestrator]
        QueryPlanner[QueryPlanner (8 Diversified Strategies)]
        StagnationDetector[StagnationDetector (Auto-Mutation)]
        Dedupe[Multi-Level Deduplication & Identity Engine]
    end

    subgraph "Houston Agent Infrastructure Layer (.houston/workspaces/huntlyst)"
        Bridge[HoustonRuntimeBridge]
        Registry[Houston Agent Registry]
        
        A1[huntlyst-discovery<br/>Skills: multi-strategy-discovery]
        A2[huntlyst-research<br/>Skills: company-profiling]
        A3[huntlyst-qualification<br/>Skills: criteria-validation]
        A4[huntlyst-enrichment<br/>Skills: executive-discovery]
        A5[huntlyst-verification<br/>Skills: email-mx-verification]
    end

    subgraph "Data & Search Provider Mesh"
        SearchMgr[SearchManager (Multi-Source Fanout)]
        P_DDG[DuckDuckGo Open Web]
        P_Claude[Claude Venture Intelligence]
        P_Serp[SerpApi Google Organic]
        P_Wires[Venture Funding Wires RSS]
        P_Dir[Curated Directory Registry]
    end

    subgraph "Persistence & Memory Layer"
        DiskStore[(Disk-Backed DB Store<br/>.huntlyst/data/huntlyst_store.json)]
        IndexDomain[Canonical Domain Index]
        IndexFingerprint[SHA-256 Composite Fingerprint Index]
        SessionMemory[Search Session State & History]
    end

    User --> UI
    UI --> Config
    Config --> APIRoute
    APIRoute --> DiscoveryEngine
    
    DiscoveryEngine --> QueryPlanner
    DiscoveryEngine --> StagnationDetector
    DiscoveryEngine --> Dedupe
    DiscoveryEngine --> Bridge
    
    Bridge --> Registry
    Registry --> A1 & A2 & A3 & A4 & A5
    
    A1 --> SearchMgr
    SearchMgr --> P_DDG & P_Claude & P_Serp & P_Wires & P_Dir
    
    DiscoveryEngine --> DiskStore
    Dedupe --> IndexDomain & IndexFingerprint
    DiscoveryEngine --> SessionMemory
    
    DiscoveryEngine -.->|SSE Events: strategy, candidates, dupes, stage| LiveStream
    LiveStream --> UI
    DiscoveryEngine --> LeadCards
```

---

## 2. Layer Responsibilities & Separation of Concerns

| Architectural Layer | Component / Directory | Primary Responsibility |
| :--- | :--- | :--- |
| **User Experience (Huntlyst)** | `app/page.tsx`, `components/*` | Pure Huntlyst brand experience. Target criteria input, real-time stage progress, live strategy telemetry, lead cards, saved leads, and CSV/JSON export. Houston is completely invisible to end-users. |
| **Application & Pipeline** | `lib/orchestration/discoveryEngine.ts`, `app/api/*` | Deterministic pipeline coordination, session tracking, candidate flow control, SSE event emissions, bounded retries, and error boundaries. |
| **Agent Infrastructure (Houston)** | `.houston/workspaces/huntlyst/*`, `lib/houston/*` | Agent turn lifecycle management, workspace definitions (`agent.json`, `CLAUDE.md`), role-specific skill declarations (`SKILL.md`), sandboxed tool registrations, and execution telemetry. |
| **Search & Discovery Mesh** | `lib/search/*`, `lib/queryPlanner.ts` | Multi-source fanout (`ISearchProvider`), 8 distinct query diversification strategies, pagination/cursor offsets, rate-limiting, and error isolation. |
| **Identity & Memory** | `lib/deduplication.ts`, `lib/stagnationDetector.ts`, `lib/db/*` | Canonical root domain resolution, corporate legal suffix stripping, composite SHA-256 fingerprinting, persistent session memory in `.huntlyst/data/huntlyst_store.json`, and automatic strategy mutation on stagnation. |
| **Verification & Evidence** | `lib/founderDiscovery.ts`, `lib/emailVerifier.ts`, `lib/evaluator.ts` | Evidence-first validation (source URLs, text snippets), DNS MX deliverability verification, namesake protection, and deterministic scoring. |

---

## 3. The 8 Discovery Strategies

To eliminate the repeat-search failure mode, the `QueryPlanner` rotates through 8 orthogonal search vectors:

1. **Strategy 1: Direct Industry + Geography**: Exact vertical keywords mapped to target nations/regions.
2. **Strategy 2: Venture Capital & Funding Signals**: Target sectors combined with financing terms (`Seed`, `Series A`, `funding round`, `raised`).
3. **Strategy 3: Hiring & Scale Signals**: Growth markers (`careers`, `we are hiring`, `open positions`, `engineering lead`).
4. **Strategy 4: Platform Architecture & Technology Signals**: Technical breadcrumbs (`API documentation`, `developer portal`, `SDK`, `integrations`).
5. **Strategy 5: Taxonomy Expansion & Synonyms**: Automated expansion using vertical synonym dictionaries (e.g. `SaaS` -> `cloud software`, `enterprise workflow`, `B2B platform`).
6. **Strategy 6: Ecosystem Directories & Registries**: High-density ecosystem sites (`site:dealroom.co`, `site:pitchbook.com`, `site:crunchbase.com`).
7. **Strategy 7: Venture News & Editorial Dispatches**: Regional journalism dispatches (`site:eu-startups.com`, `site:tech.eu`, `site:inc42.com`, `site:sifted.eu`).
8. **Strategy 8: Country-Specific Ecosystem Focus**: Iterative geographic drilling focusing on individual focus nations and regional hubs.

---

## 4. Multi-Level Deduplication & Memory

Candidate companies must pass three progressive verification filters:

1. **Canonical Domain Resolution**:
   `https://www.app.subdomain.acmecorp.io/about?ref=producthunt` -> `acmecorp.io`
   (Handles both generic TLDs and second-level ccTLDs like `.co.uk`, `.com.au`, `.co.jp`).
2. **Normalized Name & Legal Suffix Stripping**:
   `Acme Technologies, LLC` and `ACME TECHNOLOGIES INC.` -> `acme`
3. **Composite SHA-256 Fingerprinting**:
   `hashString(canonicalDomain + '::' + cleanName)` matches identical companies even when subdomains or corporate suffixes vary.
4. **Persistent Cross-Session Memory**:
   Persisted in `.huntlyst/data/huntlyst_store.json`. Re-running queries days later will immediately recognize and filter candidates previously qualified or evaluated.
