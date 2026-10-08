# Release Checklist — TVB Huntlyst

## Pre-Release Verification
- [ ] No unstaged or dirty changes in git working tree.
- [ ] Automated regression tests pass 100%: `npm test`.
- [ ] TypeScript typecheck passes with 0 errors: `npx tsc --noEmit`.
- [ ] Production build succeeds cleanly: `npm run build`.
- [ ] No credentials, API tokens, or private secrets in repository history.
- [ ] Verified deployment health via `/api/health`.
