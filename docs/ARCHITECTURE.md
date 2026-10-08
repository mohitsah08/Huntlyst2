# System Architecture — TVB Huntlyst

## 1. High-Level System Design

```
┌────────────────────────────────────────────────────────┐
│               Huntlyst Next.js 14 App                  │
│       Client Desk UI  •  SSE Streaming  •  Cards       │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────▼──────────────┐
             │    API Orchestration Layer │
             │  /api/run-agent  /api/lead │
             └─────────────┬──────────────┘
                           │
             ┌─────────────▼──────────────┐
             │ Houston Agent Runtime      │
             │ Workspaces & Skills Mesh   │
             └─────────────┬──────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ External Research Engine     │ │ Internal Offline Pipeline    │
│ • Source Discovery           │ │ • Multi-format File Parsing  │
│ • Source Inspection (Cheerio)│ │ • Lead Normalization         │
│ • Structured Fact Extraction │ │ • Offline Deterministic Rule │
│ • Cross-Source Verification  │ │ • Zero Web Fetch Safeguards  │
└──────────────────────────────┘ └──────────────────────────────┘
```

## 2. Core Modules
- **`lib/sourceInspection.ts`**: Deep source reading, domain-scoped caching, multi-tier ranking (`TIER_1_OFFICIAL`, `TIER_2_AUTHORITATIVE`, `TIER_3_REFERENCE`), and modular fact extractors.
- **`lib/discoveryPipeline.ts`**: Pipeline coordinator executing Stage 1 (`DISCOVER`), Stage 2 (`RESEARCH`), Stage 3 (`VALIDATE`), Stage 4 (`FIND_FOUNDERS`), Stage 5 (`VERIFY_CONTACT`), and Stage 6 (`QUALIFY`).
- **`lib/email.ts`**: Direct Node.js `dns.promises.resolveMx` deliverability validator.
- **`lib/targetProfileData.ts`**: Canonical investment profile schemas and persistent custom configurations.
