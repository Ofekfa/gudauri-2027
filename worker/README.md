# Gudauri 2027 — assistant proxy (Cloudflare Worker)

A tiny serverless proxy between the static site and a **free** AI model on [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/).

- **No API keys anywhere.** The Worker calls the model through Cloudflare's `AI` binding, so there's nothing secret to leak or commit.
- **System prompt built server-side** from `src/data/trip.ts` and `src/data/facts.ts`, so clients can't rewrite the assistant's instructions.
- **Abuse protection:**
  - Origin allowlist with CORS (`ALLOWED_ORIGINS` in `wrangler.toml`).
  - Per-IP rate limit of 10 requests a minute, using Cloudflare's rate-limit binding.
  - Max 500 characters per message, last 10 messages only, 16 kB body cap, 320-token answers.
- **Free-tier friendly:** Workers AI includes a daily allowance (10,000 "neurons"). With the default 8B model that's several hundred questions a day. Once it's used up, the API returns 503 and the site says to try tomorrow; nothing is ever billed on the free plan.

## Code layout

| File                             | Role                                                                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                   | Wires the route table; default export for Workers                                                                                                                                                                                            |
| `src/router.ts`                  | Shared pipeline: path → origin allowlist → CORS preflight → method → per-IP rate limit → handler                                                                                                                                             |
| `src/cors.ts`, `src/http.ts`     | CORS headers and JSON helpers                                                                                                                                                                                                                |
| `src/cache.ts`                   | `getOrRefresh`: read-through cache with TTL + stale-on-error. KV (`CACHE` binding) when configured, plus a per-isolate memory layer. The Cache API isn't used, because it's only documented as working on custom domains, not `workers.dev`. |
| `src/routes/*.ts`                | One file per route                                                                                                                                                                                                                           |
| `src/prompt.ts`, `src/limits.ts` | System prompt (from the site's `src/data`) and limits                                                                                                                                                                                        |

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
- No conversation data is stored by the Worker.
