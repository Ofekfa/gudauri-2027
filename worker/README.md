# Gudauri 2027 — Cloudflare Worker

A small serverless backend for the static site: a proxy to a **free** AI model on [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/), plus cached live data (itinerary, weather, exchange rates).

- **No API keys anywhere.** The Worker calls the model through Cloudflare's `AI` binding, so there's nothing secret to leak or commit.
- **System prompt built server-side** from `src/data/trip.ts` and `src/data/facts.ts`, so clients can't rewrite the assistant's instructions. It adds a **live-data block** (`src/liveContext.ts`): the plan for today and tomorrow, weather per zone and GEL rates, read from the same cache as the data routes, at most 1,500 characters, each source given 1.5 s. Calendar text is flattened, length-capped and introduced as data, not instructions.
- **Abuse protection:**
  - Origin allowlist with CORS (`ALLOWED_ORIGINS` in `wrangler.toml`).
  - Per-IP rate limits using Cloudflare's rate-limit bindings: 10 a minute for `/chat` (`RATE_LIMITER`), 60 a minute for the data routes (`RL_DATA`).
  - Max 500 characters per message, last 10 messages only, 16 kB body cap, 320-token answers.
- **Free-tier friendly:** Workers AI includes a daily allowance (10,000 "neurons"). With the default 8B model that's several hundred questions a day. Once it's used up, the API returns 503 and the site says to try tomorrow; nothing is ever billed on the free plan.

## Code layout

| File                             | Role                                                                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                   | Wires the route table; default export for Workers                                                                                                                                                                                            |
| `src/router.ts`                  | Shared pipeline: path → origin allowlist → CORS preflight → method → per-IP rate limit → handler                                                                                                                                             |
| `src/cors.ts`, `src/http.ts`     | CORS headers and JSON helpers                                                                                                                                                                                                                |
| `src/cache.ts`                   | `getOrRefresh`: read-through cache with TTL + stale-on-error. KV (`CACHE` binding) when configured, plus a per-isolate memory layer. The Cache API isn't used, because it's only documented as working on custom domains, not `workers.dev`. |
| `src/routes/*.ts`                | One file per route; data routes also export `loadRates`/`loadWeather`/`loadItinerary` for the live context                                                                                                                                   |
| `src/prompt.ts`, `src/limits.ts` | System prompt (from the site's `src/data`) and limits/TTLs                                                                                                                                                                                   |

To add a route, create `src/routes/<name>.ts` exporting a `Route` (method, path, `rateLimit` binding, handler) and add it to the list in `src/index.ts`.

## API

`POST /chat` with `{"messages":[{"role":"user","content":"When do we land back home?"}]}`
→ `200 {"reply":"…"}`

| Status | Meaning                          |
| ------ | -------------------------------- |
| 400    | Bad JSON / message shape         |
| 403    | Origin not in the allowlist      |
| 405    | Not `POST`                       |
| 413    | Message or body too long         |
| 429    | Rate limited (see `Retry-After`) |
| 502    | Model error                      |
| 503    | Daily free AI quota used up      |

`GET /health` → `200 {"ok":true}`

### Data routes (GET, origin-checked, `RL_DATA` limit, KV-cached with stale-on-error)

| Route        | Source                                                          | Fresh for | Stale up to | Notes                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------- | --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/rates`     | National Bank of Georgia (fallback: open.er-api.com)            | 12 h      | 7 days      | `{ base, gelPer: { ILS, EUR }, validFrom, source, fetchedAt, stale }`                                                                                                         |
| `/weather`   | Open-Meteo, one call for the three zones in `src/data/zones.ts` | 30 min    | 24 h        | Per zone: now, 7 days, last snowfall, modeled snow depth. Credit "Weather data by Open-Meteo.com" (CC BY 4.0) wherever it's shown.                                            |
| `/itinerary` | The trip calendar's secret iCal address (`CALENDAR_ICS_URL`)    | 20 min    | 7 days      | Events 23 Feb–1 Mar only, parsed with ical.js (time zones, all-day, recurrence). Only id, title, start, end, allDay and location are returned. `501` until the secret is set. |

`503` means the upstream failed and nothing usable was cached.

## Secrets and bindings

- **`CALENDAR_ICS_URL`** (secret): the Google Calendar "Secret address in iCal format". Set it from your own terminal with `npx wrangler secret put CALENDAR_ICS_URL` (it prompts; never paste it in chat or commit it). The Worker never logs or echoes it. If it leaks, reset it in Google Calendar's settings and set it again.
- **`CACHE`** (KV namespace, id in `wrangler.toml`): the data cache. A few hundred writes a day at most, within the free tier.
- **`RATE_LIMITER`**, **`RL_DATA`**: rate-limit bindings (see above).
- **`AI`**: Workers AI.

## One-time setup (≈5 minutes)

You only do this once. You never need to copy an API key.

1. **Create a free Cloudflare account** at <https://dash.cloudflare.com/sign-up> and verify your email.
2. **Install and log in** (opens a browser tab for OAuth):
   ```sh
   cd worker
   npm install
   npx wrangler login
   ```
3. **Deploy:**
   ```sh
   npx wrangler deploy
   ```
   - The first time, Wrangler may ask you to pick a free `*.workers.dev` subdomain.
   - It prints the Worker URL, e.g. `https://gudauri-2027-assistant.<your-subdomain>.workers.dev`.
4. **Check it** (should print `{"ok":true}`):
   ```sh
   curl https://gudauri-2027-assistant.<your-subdomain>.workers.dev/health
   ```
5. **Connect the site:** in GitHub, open **Settings → Secrets and variables → Actions → Variables** and add a repository _variable_ (not a secret, since the URL is public):
   - Name: `VITE_ASSISTANT_URL`
   - Value: the Worker URL from step 3, with no trailing slash

   Or from the repo root: `gh variable set VITE_ASSISTANT_URL --body "https://…workers.dev"`.

6. **Redeploy the site**: Actions → "Deploy to GitHub Pages" → Run workflow (or push any change).

For local development, put the same line in `.env.local` at the repo root (git-ignored): `VITE_ASSISTANT_URL=https://…workers.dev`.

## Automatic deploys (GitHub Actions)

`.github/workflows/worker-deploy.yml` tests and deploys the Worker on every push to `main` that touches `worker/**` or the shared site code it bundles (`src/data/**`, `src/lib/facts/types.ts`, and the weather, itinerary and currency libraries). You can also run it by hand from the Actions tab. If the secrets below are missing, the job still runs the tests but skips the deploy, with a warning.

**One-time setup** (repository secrets):

1. Create a Cloudflare API token:
   - Dashboard → profile icon → **My Profile → API Tokens → Create Token → Create Custom Token**.
   - Name: `gudauri-worker-deploy`.
   - Permissions:
     - **Account → Workers Scripts → Edit**
     - **Account → Workers KV Storage → Edit**
   - Account Resources: **Include → your account**.
   - **Continue to summary → Create Token**. Copy the token; it's shown only once.
   - If the first deploy fails with an authentication or permission error, edit the token and add **Account → Account Settings → Read** and **User → Memberships → Read**.
2. Find your **Account ID**: Dashboard → **Workers & Pages** → right-hand sidebar.
3. Add two secrets on GitHub under **Settings → Secrets and variables → Actions → New repository secret**:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

   Or add them from your own terminal, so the values never appear in chat: `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID`.

## Day-to-day

```sh
npm test            # unit tests (no Cloudflare account needed)
npm run typecheck
npx wrangler dev    # local server; AI calls still run on Cloudflare (requires login)
npx wrangler deploy # ship changes
npx wrangler tail   # live logs
```

- **Switch model:** change `MODEL` in `wrangler.toml`, e.g. `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for smarter but ~6× costlier answers, then deploy.
- **Allow another site:** add it to `ALLOWED_ORIGINS`.

## Notes

- The Origin check stops other _websites_ from using the quota. A script can fake the header, so the rate limit and the free-tier cap are the real backstop.
- No conversation data is stored by the Worker. KV holds only the cached upstream data.
- The live context uses Workers AI's small 8B model, which can still misread details (for example, mislabel a calendar event). Rates are given to it as ready-made conversions so it doesn't do arithmetic.
