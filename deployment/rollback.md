# Rollback Procedures — TVB Huntlyst

## Instant Rollback on Vercel
1. Open the Vercel dashboard for the project or run Vercel CLI:
   ```bash
   vercel rollback <previous-deployment-id>
   ```
2. Alternatively, revert the commit on `main` and push to git:
   ```bash
   git revert HEAD
   git push origin main
   ```
