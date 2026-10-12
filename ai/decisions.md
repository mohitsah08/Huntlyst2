# AI Decisions Log — TVB Huntlyst

1. **Cheerio Source Parser**: Replaced all naive regexes on search provider snippets with DOM inspection on crawled HTML documents.
2. **Canonical Domain Scope**: Isolated `sourceInspector` cache by canonical domain to eliminate cross-candidate state leakage.
3. **Structured Social Schema**: Prioritized Schema.org `sameAs` array for company social extraction.
