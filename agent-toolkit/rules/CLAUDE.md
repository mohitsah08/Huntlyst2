# Claude Code Development & MCP Instructions
# Ported from Antigravity Environment (2026-09-27)

# Global Development & MCP Instructions

You are operating with a permanent global MCP toolkit configured across all current and future projects in Antigravity. Proactively use these tools whenever relevant—do NOT wait for explicit user prompting to use MCP.

---

## 1. Automatic MCP Tool Usage Matrix

Whenever an issue or task involves any of the domains below, immediately reach for the corresponding MCP server:

| Domain / Issue Category | Primary MCP Server | Trigger Conditions & Action |
| :--- | :--- | :--- |
| **Database & Supabase** | **Supabase MCP** | Database issues, schema definitions, tables, columns, relations, RLS policies, PostgreSQL functions, database runtime errors. |
| **Browser, Console & Network** | **Chrome DevTools MCP** | Console errors, JS runtime exceptions, CSS layout bugs, failed fetch/XHR, CORS issues, network bottlenecks, DOM inspection. |
| **User Flows & Responsive E2E** | **Playwright MCP** | Real user flows, interactive UI testing, forms, modals, multi-step transactions, mobile vs. desktop viewports, responsive verification. |
| **Repository, History & Git** | **GitHub MCP** | Inspecting repo state, commit history, branch comparison, PR review, analyzing recent changes to identify regression culprits. |
| **Deployments & Serverless Logs** | **Vercel MCP** | Vercel build failures, deployment errors, production serverless runtime logs, environment issues, production-only bugs. |

---

## 2. 9-Step Debugging Workflow

For any project, follow this rigorous workflow whenever a bug or issue is reported:
1. **Inspect Existing Code First**: Review the local code, types, and logic related to the problem.
2. **Reproduce the Problem**: Validate the unexpected behavior through code paths or local execution.
3. **Inspect the Real Source with MCP**: Use the relevant MCP (Supabase for DB state, DevTools for console/network, Playwright for UI flow, Vercel for prod logs) to observe actual runtime reality.
4. **Identify the Root Cause**: Pinpoint why the failure occurs based on real data, not guesswork.
5. **Make the Smallest Correct Fix**: Apply targeted, minimal changes that solve the root cause.
6. **Test the Fix**: Validate locally that the fix resolves the issue.
7. **Test Relevant Desktop & Mobile Behavior**: Verify responsive rendering and interaction across viewports.
8. **Check for Regressions**: Ensure neighboring features, types, and flows remain unbroken.
9. **Report Completion**: Deliver a concise summary of the fix and verification evidence.

*Never guess when an MCP server can verify the actual state.*

---

## 3. Tool-Specific Rules & Protocols

### Supabase Rules
- **Schema Inspection**: Always inspect actual tables, columns, relationships, indexes, constraints, RLS, policies, functions, and database errors using Supabase MCP.
- **No Hallucinated Schemas**: Never invent table or column names if Supabase MCP can inspect the real schema.
- **Preserve RLS**: Never disable Row Level Security (RLS) just to make a feature work.
- **Data Privacy**: Never make private financial, user, or auth data publicly readable.
- **Zero Secret Exposure**: Never expose Supabase `service_role` secrets to frontend code or public configs.
- **Safe Permissions**: Adhere to the safest permissions supported by the database.

### Playwright Rules
- **Real Application Testing**: Use Playwright for real browser interactions—do not assume UI works just because code compiles or renders in isolation.
- **Test Matrix**: Test desktop viewports, mobile viewports (e.g., iPhone / generic mobile), navigation, forms, buttons, dialogs, auth flows, customer flows, transaction flows, and file downloads where supported.

### Chrome DevTools Rules
- **Inspect Before Editing**: When debugging browser or client errors, inspect the actual console logs, network requests, and DOM state before changing code.
- **Targeted Debugging**: Use Chrome DevTools for JavaScript runtime exceptions, missing CSS, failed network requests, CORS misconfigurations, and layout shifts.

### GitHub Rules
- **Non-Destructive Operations**: Use GitHub MCP to inspect repositories, review implementation history, inspect recent commits/branches, and diagnose regressions.
- **Safety**: Never make destructive repository changes without explicit user approval.

### Vercel Rules
- **Production Truth**: When a problem only occurs in production, immediately inspect Vercel deployment metadata, build logs, and runtime serverless function logs before guessing.
- **Deployment Context**: Leverage Vercel MCP to check deployment status, environment variables, and build outputs.

---

## 4. Security & Confidentiality Principles

- **No Hardcoded Secrets**: Never place API keys, private tokens, service-role keys, database credentials, or secret variables inside public configuration files, frontend code, git commits, browser `localStorage`, or APKs.
- **Official Auth Mechanisms**: Use official credential mechanisms (environment variables, secure keyrings, or OAuth flows) to authenticate.

---

## 5. Current Priority: Digital Khata Workspace

When working in the **Digital Khata** workspace, apply this MCP toolkit particularly aggressively for:
- Supabase schema, RLS policies, and customer/transaction data integrity.
- Correct handling of transaction IDs, customer balances, and ledger summaries.
- PDF generation and receipt viewing/download behavior.
- Mobile PWA experience and responsive layouts across viewport sizes.
- Browser console warnings/errors and network fetch optimization.
- Production Vercel deployment status and serverless function runtime logs.

Keep this configuration global so all of the above capabilities remain available for every future workspace.


---

# Higgsfield AI Global Integration & Usage Matrix

You are permanently configured to use **Higgsfield AI** (https://higgsfield.ai/) across all current and future projects in Antigravity. Proactively leverage Higgsfield whenever visual media, video, photography, or creative assets are needed—do not settle for generic placeholders or standard static mockups.

---

## 1. Core Capabilities & Skill Matrix

Higgsfield AI provides a suite of generative image, video, brand, and media tooling accessible via MCP, CLI (`higgsfield` / `hf`), and specialized skills:

| Domain / Creative Need | Recommended Skill / Command | Key Models & Workflows |
| :--- | :--- | :--- |
| **General Image Generation** | `higgsfield-generate` | `gpt_image_2` (design/typography), `nana_banana_pro` / `nana_banana_2` (characters & photorealism). |
| **Cinematic & Short-Form Video** | `higgsfield-generate` | `seedance_2` (motion & UGC), `kling_3` (cinematic dynamics), 9:16 / 16:9 aspect ratios. |
| **Product & Brand Photoshoots** | `higgsfield-product-photoshoot` | Studio shots, lifestyle scenes, model try-ons, hero banners, and ad creative packs. |
| **E-Commerce & Listing Cards** | `higgsfield-marketplace-cards` | Compliant marketplace images, secondary shots, and A+ rich content modules. |
| **Brand Identity & Systems** | `higgsfield-brandkit` | Deterministic palettes, vector logos, typography pairings, packaging, and presentation decks. |
| **Explainer & Story Videos** | `higgsfield-video-explainer` | Ordered narrative blocks, voiceover synchronization, subtitles, and mascot animation. |
| **Thumbnails & Social Covers** | `higgsfield-youtube-thumbnail` | Information-gap thumbnails, face consistency, and high-CTR social covers. |
| **Identity & Character Twin** | `higgsfield-soul-id` | Train Soul Characters for identity-consistent generation across images and video. |

---

## 2. Global Tooling Setup

- **Higgsfield MCP Server**: Configured globally in `~/.gemini/config/mcp_config.json` via endpoint `https://mcp.higgsfield.ai/mcp`.
- **Higgsfield CLI**: Globally installed as `/usr/local/bin/higgsfield` (alias: `hf`).
- **Companion Skills**: Installed in `~/.gemini/config/skills/` (`higgsfield-*`).

---

## 3. Mandatory Behavioral Rules for Every Project

1. **Zero Placeholder Policy**: Never leave empty gray rectangles, `via.placeholder.com` links, or broken asset paths when designing UI/UX. Call Higgsfield tools or the CLI to generate rich, contextual images and video clips.
2. **Context-Aware Style Selection**:
   - For UI elements, logos, and graphic layouts with text: Use `gpt_image_2`.
   - For realistic creator/human avatars and product shots: Use `nana_banana_2` / `nana_banana_pro` or `higgsfield-product-photoshoot`.
   - For dynamic motion, ads, and background loops: Use `seedance_2` or `kling_3`.
3. **Local Asset Preservation**: Save generated media to appropriate project asset directories (e.g. `public/images/`, `src/assets/`) with descriptive filenames.
4. **Authentication Check**: When executing generation commands via CLI, ensure authentication (`higgsfield auth login` or valid token in environment) is active.

