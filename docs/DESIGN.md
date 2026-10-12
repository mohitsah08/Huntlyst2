# Design System & UI Specifications — TVB Huntlyst

## 1. Visual Aesthetics
- **Editorial Warm Design**: Tailored warm neutral backgrounds (`#FAF9F6`, `#18181B`), refined typography, subtle glassmorphism borders (`border-stone-200 / border-zinc-800`), and semantic badge tokens.
- **Micro-Animations**: Framer Motion transitions for card entrances, progressive stage loaders, and status pills.
- **Responsiveness**: Desktop multi-column grid adapting gracefully into mobile card viewports.

## 2. Component Hierarchy
- `components/DiscoverView.tsx`: Main discovery console and mode selector (Internal / External / Automation).
- `components/StagedDiscoveryWorkflow.tsx`: 6-stage progressive visualization showing live step attempts and completion timers.
- `components/CandidateVerificationCard.tsx`: Deep dossier card surfacing company identity, funding timeline, leadership roster, verified emails, and field audits.
- `components/LeadDetailModal.tsx`: Comprehensive modal presenting raw evidence snippets and conflict resolution logs.
