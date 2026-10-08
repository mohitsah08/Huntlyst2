# Project Memory & Knowledge System — TVB Huntlyst

## 1. Context & Evolution
TVB Huntlyst originated as an autonomous venture discovery platform for identifying high-conviction early-stage technology companies. It evolved from basic web scraping to an evidence-grounded multi-agent system powered by the Houston execution runtime.

## 2. Key Learned Lessons
1. **Never Trust Snippets Alone**: Search engines return snippet combinations that cross sentence boundaries. Deep source reading of authentic pages is essential.
2. **Cache Isolation Matters**: Shared in-memory caches between companies cause cross-contamination (e.g. Traction Ag HQ leaking into Mindfuel). Always isolate caches by domain.
3. **Structured Social Profiles**: Schema.org JSON-LD `sameAs` arrays are the highest-confidence source for authentic company social links.
