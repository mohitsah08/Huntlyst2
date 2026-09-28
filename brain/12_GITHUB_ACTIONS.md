# GitHub Actions / CI/CD

## Current Status

**Not yet implemented** — No GitHub Actions workflows exist in this repository.

## Recommended Minimal Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run lint
        run: npm run lint
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Build
        run: npm run build
        env:
          SERPAPI_KEY: ${{ secrets.SERPAPI_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          ABSTRACT_API_KEY: ${{ secrets.ABSTRACT_API_KEY }}

  # Optional: Deploy on merge to main
  # deploy:
  #   needs: build
  #   if: github.ref == 'refs/heads/main'
  #   runs-on: ubuntu-latest
  #   steps:
  #     - uses: actions/checkout@v4
  #     - name: Deploy to Vercel
  #       uses: amondnet/vercel-action@v25
  #       with:
  #         vercel-token: ${{ secrets.VERCEL_TOKEN }}
  #         vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
  #         vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
  #         vercel-args: '--prod'
```

## Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `SERPAPI_KEY` | SerpAPI key for build-time validation |
| `ANTHROPIC_API_KEY` | Anthropic key for build-time validation |
| `ABSTRACT_API_KEY` | Abstract API key (optional) |
| `VERCEL_TOKEN` | Vercel access token (if deploying to Vercel) |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

## Notes

- Build requires env vars — they must be available in CI for `npm run build` to succeed
- Consider adding a separate "smoke test" job that runs the agent against a test endpoint
- Linting currently uses Next.js built-in ESLint config
- Type checking via `tsc --noEmit` catches type errors without emitting files