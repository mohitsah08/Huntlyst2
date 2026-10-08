# Deployment Guide — TVB Huntlyst

## Production Deployment to Vercel
1. Ensure the `main` branch is clean and passing all tests.
2. Push to GitHub:
   ```bash
   git push origin main
   ```
3. Vercel automatically detects pushes to `main` and creates an optimized production deployment.
4. Verify deployment health endpoint:
   ```bash
   curl -s https://<production-url>/api/health
   ```
