# Build Process & Configuration — TVB Huntlyst

## Build Instructions
1. Install dependencies:
   ```bash
   npm install
   ```
2. Type check:
   ```bash
   npx tsc --noEmit
   ```
3. Run automated regression tests:
   ```bash
   npm test
   ```
4. Build Next.js 14 production bundle:
   ```bash
   npm run build
   ```
