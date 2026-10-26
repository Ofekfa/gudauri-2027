# Handoff — 2026-10-26

Read this first in a new session, then `PLAN.md` (phases, decisions, ideas) and `docs/CODEBASE_REPORT.md` (architecture) as needed. Procedures with commands are in `docs/OPERATIONS.md`.

## Current state

- **Last tag:** `v1.16.0` (shield, slow-mo, double points; #108). `main` is at the `docs/handoff` PR that wrote this file, right after `70828d4` (#109).
- **Live site:** https://ofekfa.github.io/gudauri-2027/ — Pages deploys every push to `main`. Last checked 2026-10-26: the Pages deployment is at `70828d4` (then `main`), and every CI/deploy run on `main` is green.
- **Worker:** https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev — last deployed 2026-10-23 20:48Z by CI from `43569a7` (#108). Nothing the Worker bundles has changed since, so it matches `main`. `SCORE_EPOCH` is `"2"`.
- **Branches and PRs:** only `main` on the remote; no open PRs; no work-in-progress branches; nothing stashed.
- **Live data in use:** since 2026-10-23 the crew has posted real game runs (epoch 2) and Ofek has 2 album photos (McDonald's). Treat both as personal data: never delete or reset them without Ofek's explicit "yes".
- **Tests:** 477 site + 103 Worker, all passing.

## In progress

Nothing is half-built. One temporary item waits for Ofek:

- **Phase 10.6b — pick a game difficulty preset.** Three trial presets are live behind hidden links (the normal game uses `faster`):
  - https://ofekfa.github.io/gudauri-2027/#/game?preset=fast (280 → 480 → 680 px/s)
  - https://ofekfa.github.io/gudauri-2027/#/game?preset=faster (300 → 520 → 720, the default)
  - https://ofekfa.github.io/gudauri-2027/#/game?preset=fastest (340 → 600 → 800)
  - Bot medians: fast 171 s, faster 176 s (with all four power-ups), fastest 153 s.
  - After the pick: lock it in and remove the switch. Steps are in `docs/OPERATIONS.md` → "Lock in the game difficulty preset". If Ofek says "keep the default", the pick is `faster`.

## Open questions for Ofek

1. Which preset: `fast`, `faster` (current default) or `fastest`?
2. Real-phone results (see the checklist below): album, scores sync, the power-ups.
3. Did the two-phone shared-lists check (`v1.11.0`) work?
4. Day-1 calendar times: still deferred ("let's deal with the time later")?
5. What's next, if anything, from the unscheduled ideas in `PLAN.md` (expenses / settle-up, ski-day briefing, offline safety card, trip awards)?
6. Should the stale "Lists are saved on this device only" text in Backup be fixed (bug 1 below)? It's a one-line fix, offered but not done.

### Real-phone checklist (owed by Ofek; not testable here)

- **Album:** camera and gallery multi-select on iOS Safari and Android Chrome; HEIC photos arrive as JPEG; airplane mode → "Waiting for connection", then uploads; swipe a moment card; add a "Breakfast" moment; snowflakes look right.
- **Scores:** a record on phone A appears on phone B; an offline run syncs when back online; a phone that had pre-reset records shows them gone.
- **Game:** each power-up (❤️ 🧲 🛡️ ⏳ 2×) works and shows its timer; the shield saves a crash ("🛡️ Saved!"); slow-mo slows the slope but not steering; 2× doubles khachapuri points; touch steering feels right.
- **Older items:** iPhone music playback; Kudebi webcam on a phone; Georgian script rendering.

## Known bugs and risks

1. **Stale UI text:** `src/components/common/BackupPanel.tsx:66` still says "Lists are saved on this device only" (plus a comment in `src/lib/todo/repository.ts:6`). Lists have synced since `v1.11.0`. Cosmetic.
2. **Trial-preset code is temporary:** `presets.ts`, `PRESETS` and the HUD label exist until 10.6b. Meanwhile the score bound uses the most generous preset (slightly looser than needed).
3. **`RL_AUTH` (5/min per IP)** also covers token renewals. Four phones behind one hotel IP could hit it; the client retries (capped at 5 tries) and then shows "Upload failed — tap to retry".
4. **Album `uploadedBy`** comes from the upload's details, not the token, so any member can credit a photo to someone else. Low risk among four friends.
5. **Album images offline** rely on the browser HTTP cache (`immutable`), not the service worker.
6. **Not verified on real phones:** iOS camera input, HEIC → JPEG, IndexedDB Blobs on older iOS, uploads on weak signal, game touch feel, Web Speech on iOS.
7. **Rate limits are approximate** (free binding; bursts of ~75 got through in testing). The Workers AI daily allowance is the hard cap.
8. **No CSP** (a deliberate decision, see `PLAN.md`).
9. **QA scripts aren't in the repo.** The puppeteer checks (`album-e2e`, `gamelive`, `snowperf`, balance `metrics.sh` …) lived in session scratchpads and are gone. The committed tests are unit-level. Recreate scripts as needed (puppeteer-core is a dev dependency).
10. **Score-reset backups** (epoch 1 → 2, 46 runs) are only on Ofek's Mac in `~/gudauri-2027-backups/` (Ofek also got a copy in chat). Never commit them.

## Manual setup status (names only)

| Item                                                                       | Status                                   | How it's checked                                                                  | How to rotate                                                                |
| -------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GROUP_CODE` (Worker secret)                                               | ✅ Set                                   | `cd worker && npx wrangler secret list`; `/sync` gives 401 for a wrong code       | `npx wrangler secret put GROUP_CODE` (Ofek types it); phones re-join         |
| `ALBUM_SIGNING_KEY` (Worker secret)                                        | ✅ Set 2026-10-22                        | `secret list`; `POST /album/session` gives 401 (not 501) for a wrong code         | `openssl rand -base64 48 \| npx wrangler secret put ALBUM_SIGNING_KEY`       |
| `CALENDAR_ICS_URL` (Worker secret)                                         | ✅ Set                                   | `secret list`; `/itinerary` returns events                                        | Reset the secret address in Google Calendar, then `secret put`               |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (GitHub secrets)           | ✅ Set 2026-10-21                        | `gh secret list`; Worker deploys succeed                                          | New token in the Cloudflare dashboard → `gh secret set CLOUDFLARE_API_TOKEN` |
| `VITE_ASSISTANT_URL` (GitHub variable)                                     | ✅ Set                                   | `gh variable list`                                                                | Only if the Worker URL changes                                               |
| Wrangler login on Ofek's Mac                                               | ✅ Logged in (OAuth, checked 2026-10-26) | `npx wrangler whoami`                                                             | `npx wrangler login`                                                         |
| KV `CACHE`, DOs `LISTS`/`ALBUM`/`SCORES` (migrations v1–v3), rate limiters | ✅ Created by deploys                    | `wrangler deployments list`; live routes answer                                   | Nothing to rotate                                                            |
| `ALBUM_PASSCODE`, R2 bucket                                                | n/a                                      | Don't exist by design (the album reuses `GROUP_CODE`; storage is Durable Objects) | —                                                                            |

## Things that may expire or drift (recheck after a few weeks)

- **Wrangler OAuth login** on the Mac expires or gets revoked → `npx wrangler login`. CI doesn't depend on it.
- **Cloudflare API token:** check whether it has an expiry date (Cloudflare dashboard → API Tokens). If CI's "Deploy Worker" starts failing with an auth error, rotate it.
- **Album tokens** expire at the later of 2027-03-15 23:59 UTC and issue + 30 days, and renew silently with < 14 days left. Nothing to do before the trip; after 2027-03-15 a phone that hasn't opened the site for 30 days re-joins silently with its stored code.
- **Free-tier limits** (as understood in 2026-10; recheck on Cloudflare's pricing pages): Workers 100k requests/day; Workers AI ~10k neurons/day; KV 100k reads and 1,000 writes/day, 1 GB; Durable Objects SQLite on the Free plan (request, duration and storage quotas; 2 MB per row is why images are sharded per moment). Also GitHub Pages (1 GB site, soft 100 GB/month) and Open-Meteo's non-commercial limit (10k calls/day; we use ~50).
- **External APIs:** NBG rates JSON (`fetch:rates` in every Pages deploy, plus the Worker), open.er-api.com fallback, Open-Meteo, the Google Calendar iCal feed, Overpass (only `fetch:pistes`).
- **Webcams:** the Vitamin Cafe YouTube live streams (Soliko `vBVWcSjPAZM`, Kudebi `aCHJ-r15RLM` in `src/data/zones.ts`) get a new id when a stream restarts; check them closer to the trip.
- **Music:** Commons/archive.org MP3 URLs and the six YouTube embeds can disappear; run `npm run analyze:tracks` and open `#/music`.
- **Tooling:** Node 22 (`engines`), Wrangler 4.151 with `compatibility_date` 2026-10-01, ESLint pinned to 9 (jsx-a11y). Check `npm outdated` before upgrading anything; there's no Dependabot.
- **Trip-time features** only show during the trip (2027-02-24 → 02-28, Tbilisi): Quick add, Today's plan, dinner suggestions. Test them by injecting `now` in unit tests, not by waiting.
- **Score epoch:** a deploy from a branch with an older `SCORE_EPOCH` can't undo a reset (a lower epoch is ignored), but keep `wrangler.toml` at `"2"` or later.

## Recent history (2026-10-22 → 10-23, details in `PLAN.md`)

- `v1.12.0`–`v1.12.1`: album, then the fix for uploads stuck at 0 % (the signing key wasn't set and the client retried forever; now capped and explained).
- `v1.13.0`: moment card carousel, our own moments, bigger snowfall.
- `v1.14.0`: shared game high scores and crew leaderboard.
- `v1.15.0`–`v1.15.2`: hearts, power-up system and magnet; the faster retune with trial presets; score epochs and the reset of all 46 old runs (Ofek confirmed).
- `v1.16.0`: shield, slow-mo and double points.

## Next action

Ask Ofek which game preset to keep (`fast`, `faster` or `fastest`), then do Phase 10.6b (`docs/OPERATIONS.md` → "Lock in the game difficulty preset") and tag `v1.16.1`; meanwhile collect Ofek's real-phone checklist results.
