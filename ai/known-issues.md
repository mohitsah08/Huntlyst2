# AI Known Issues & Mitigations — TVB Huntlyst

1. **Anti-Bot Scraping Blocks (Cloudflare 403 / Captcha)**:
   - *Impact*: Direct fetching on heavily protected consumer sites can return 403 or anomaly challenges.
   - *Mitigation*: Fallback to Wikipedia API, secondary search providers (Brave, SerpApi), and authoritative public registries.
2. **Dynamic Client-Side Single Page Apps (SPA)**:
   - *Impact*: Websites rendering purely via client JS might lack SSR text in initial HTML.
   - *Mitigation*: Schema.org JSON-LD parsing and meta tag inspection reliably extract essential venture facts without full browser emulation overhead.
