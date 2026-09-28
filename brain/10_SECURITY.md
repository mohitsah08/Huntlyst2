# Security

## Secrets Management

| Secret | Location | Required |
|--------|----------|----------|
| `SERPAPI_KEY` | `.env.local` (not committed) | Yes |
| `ANTHROPIC_API_KEY` | `.env.local` (not committed) | Yes |
| `ABSTRACT_API_KEY` | `.env.local` (not committed) | No |

**No hardcoded secrets** anywhere in the codebase. All accessed via `process.env.*`.

---

## .gitignore Status

**Currently**: No `.gitignore` file exists in the project root.

**Required entries** (should be added):
```
# Dependencies
node_modules/

# Build output
.next/
out/

# Environment files
.env
.env.local
.env.production.local
.env.development.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/
```

---

## Input Validation

### API Route (`/api/run-agent`)
- **Request body**: Not validated (empty object expected)
- **Query parameters**: None
- **Headers**: Only `Content-Type` checked implicitly by Next.js

**Gap**: No validation of request origin, rate limiting, or payload size.

### Frontend
- No user inputs (only button clicks)
- CSV export: client-side only, no server interaction

---

## Output Sanitization

- API returns JSON — safe from XSS
- Frontend renders data via React (auto-escapes)
- CSV export: values escaped for CSV injection prevention (`escapeCsv` function)

---

## Rate Limiting / Abuse Prevention

**Currently**: **Not implemented**

**Risks**:
- Public endpoint can be called repeatedly
- Each run consumes SerpAPI credits (5-15 per run)
- Each run consumes Anthropic API tokens
- Long-running requests (up to 5 min) could tie up server resources

**Recommended**:
1. Add IP-based rate limiting (e.g., 1 request per 5 minutes)
2. Add authentication (API key, session, or OAuth)
3. Consider moving to authenticated user context
4. Add request timeout enforcement at load balancer level

---

## CORS

**Current**: Next.js default (same-origin only for API routes)
- Frontend calls same-origin API → no CORS issues
- External callers would be blocked by default

---

## Content Security Policy

**Current**: None configured (Next.js default)

**Recommended for production**:
- Add `Content-Security-Policy` header via `next.config.js`
- Restrict script sources, frame ancestors, etc.

---

## Dependency Security

**Audit Status**: 2 vulnerabilities (1 high, 1 critical) from `npm audit`
- Related to `next@14.2.13` (security update available)
- Run `npm audit fix --force` to address (may have breaking changes)

**Action**: Update Next.js to patched version before production deployment.

---

## Deployment Considerations

- Ensure `.env.local` is not deployed (use platform secret management)
- Use platform-provided secret injection (Vercel Environment Variables, Railway Variables, etc.)
- Never commit `.env.local` or any file with actual keys
- Rotate keys periodically
- Monitor API usage for anomalies (unexpected spike = possible leak)