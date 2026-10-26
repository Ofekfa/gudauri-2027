# Operations — Gudauri 2027

Copy-paste procedures for running the site and the Worker. Run commands from the repo root unless a step says `cd worker`. **Secrets are never typed into chat, code or git**: every `wrangler secret put` / `gh secret set` below prompts for the value (or reads it from a pipe) so it never appears on screen.

Names only (never values):

| Kind                    | Name                                                                                | Where                   |
| ----------------------- | ----------------------------------------------------------------------------------- | ----------------------- |
| Worker secret           | `GROUP_CODE`, `ALBUM_SIGNING_KEY`, `CALENDAR_ICS_URL`                               | `npx wrangler secret …` |
| Worker var              | `ALLOWED_ORIGINS`, `MODEL`, `SCORE_EPOCH`                                           | `worker/wrangler.toml`  |
| Worker bindings         | `AI`, `RATE_LIMITER`, `RL_DATA`, `RL_AUTH`, KV `CACHE`, DO `LISTS`/`ALBUM`/`SCORES` | `worker/wrangler.toml`  |
| GitHub Actions secret   | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`                                     | `gh secret list`        |
| GitHub Actions variable | `VITE_ASSISTANT_URL` (the Worker URL; not secret)                                   | `gh variable list`      |

## Health check (start of a session)

```sh
git status && git fetch --prune && git log --oneline -1 origin/main && git describe --tags --abbrev=0
gh pr list --state open
gh run list --branch main --limit 4                       # last Pages + Worker deploys green?
gh api repos/Ofekfa/gudauri-2027/deployments --jq '.[0] | "\(.sha[0:7]) \(.created_at)"'   # Pages sha = main?
cd worker && npx wrangler whoami && npx wrangler deployments list | tail -8 && cd ..
curl -s https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev/health    # {"ok":true}
```

If `wrangler whoami` says you're logged out: `cd worker && npx wrangler login` (opens the browser; Ofek approves).

## Shipping a change

```sh
git checkout -b feat/<name>            # or fix/, docs/, chore/
npm run lint && npm run typecheck && npm test && TZ=America/Los_Angeles npm test && npm run build
cd worker && npm run typecheck && npm test && cd ..      # if the Worker or shared code changed
git push -u origin HEAD && gh pr create --fill           # then add a description + checklist
gh pr checks <n>                                         # `--watch` is unreliable right after creation
gh pr merge <n> --squash --delete-branch
git checkout main && git pull
git tag -a v1.N.0 -m "…" && git push origin v1.N.0       # at the end of a phase
```

Pushing to `main` deploys Pages (`deploy.yml`). The Worker redeploys automatically only when the push touches the paths in `.github/workflows/worker-deploy.yml`.

## Worker deploy

- **Normal:** merge to `main`; CI (`worker-deploy.yml`) typechecks, tests and deploys.
- **Force a CI deploy** (e.g. after a change outside the path filter): `gh workflow run worker-deploy.yml`, then `gh run list --workflow worker-deploy.yml --limit 1`.
- **Manual (only if CI is broken):** `cd worker && npm ci && npm test && npx wrangler deploy`.
- **Logs:** `cd worker && npx wrangler tail` (Ctrl-C to stop).
- **Pages redeploy without a code change:** `gh workflow run deploy.yml` (also refreshes the baked rate).

## Rotate the group code (`GROUP_CODE`)

Unlocks shared lists, album changes and score posting.

1. Ofek picks a new long passphrase (never in chat).
2. `cd worker && npx wrangler secret put GROUP_CODE` and type it at the prompt.
3. Ofek shares it privately with Ron, Roi and Maya. Each phone re-joins (Packing → Sync, or the album's Join form). Old album tokens keep working until they expire; rotate `ALBUM_SIGNING_KEY` too to cut them off at once.

## Rotate the album signing key (`ALBUM_SIGNING_KEY`)

Logs every phone out of the album; phones that still have the group code get a new token silently.

```sh
cd worker && openssl rand -base64 48 | npx wrangler secret put ALBUM_SIGNING_KEY
```

## Change the calendar feed (`CALENDAR_ICS_URL`)

Google Calendar → Settings → the calendar → "Secret address in iCal format" (reset it there if it leaked). Then `cd worker && npx wrangler secret put CALENDAR_ICS_URL` and paste at the prompt. The Worker refetches within 20 minutes.

## Rotate the Cloudflare API token (CI deploys)

1. Cloudflare dashboard → My Profile → API Tokens → create a token with **Workers Scripts: Edit** and **Workers KV Storage: Edit** for the account (add **Durable Objects** permissions only if a deploy ever asks for them).
2. `gh secret set CLOUDFLARE_API_TOKEN` and paste at the prompt.
3. `gh workflow run worker-deploy.yml` and check it's green. Revoke the old token in the dashboard.

## Reset every game score (epoch bump)

Deletes every shared run and makes phones drop their local records. **Real runs exist** (the crew has played since 2026-10-23), so only with Ofek's explicit "yes".

```sh
cd worker
npm run scores:reset -- --dry-run    # backup of GET /game/scores to ~/gudauri-2027-backups + counts per character
npm run scores:reset                 # shows counts, asks for "yes", bumps SCORE_EPOCH, deploys, captures the purge log, checks empty
```

Then commit the changed `worker/wrangler.toml` in a `fix/` PR so later CI deploys keep the new epoch. **Never commit backups** (personal data). It's deliberately not an HTTP route. Previous backups (epoch 1 → 2, 46 runs) are in `~/gudauri-2027-backups/` on Ofek's Mac.

## Lock in the game difficulty preset (Phase 10.6b, waiting for Ofek)

When Ofek picks `fast`, `faster` or `fastest`:

1. In `src/game/constants.ts` make that profile `DEFAULT_PROFILE` (today `PRESETS.faster`) and delete the `PRESETS` map and `PresetName`.
2. Delete `src/game/presets.ts` and `presets.test.ts`; remove `presetLabel` from `controller.ts`, `render.ts` and `GamePage.tsx`.
3. `scores.ts`: `SCORING_PROFILES` becomes `[DEFAULT_PROFILE]`. Tests that loop over `Object.values(PRESETS)` (`balance`, `fairness`, `powerUps`, `scores`) switch to `DEFAULT_PROFILE`.
4. Re-run `balance.test.ts`, `fairness.test.ts`, the Worker tests; patch-tag (`v1.16.1`). The bound only shrinks if the slowest preset is picked; scores already stored stay.

## Local end-to-end (Worker + site)

Test values only, never the real code or key.

```sh
rm -rf worker/.wrangler/state
cd worker && npx wrangler dev --port 8787 --var GROUP_CODE:local-test-code-khinkali --var ALBUM_SIGNING_KEY:local-test-signing-key-0123456789
# second terminal:
VITE_ASSISTANT_URL=http://localhost:8787 npm run build && npx vite preview --port 4173
# afterwards:
rm -rf worker/.wrangler/state
```

Local rate limiters are real (`RL_DATA` 60/min, `RL_AUTH` 5/min).

## Data and asset scripts

| Command                     | When                                                          | Needs / then                                                                                                                                |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run fetch:pistes`      | Rarely (OSM changed)                                          | Network (Overpass). Review the diff of `src/data/pistes.json`; the map test must pass.                                                      |
| `npm run fetch:rates`       | Automatic on every Pages deploy                               | Network (NBG). Never fails the build.                                                                                                       |
| `npm run fetch:dish-images` | After editing `scripts/dish-image-sources.ts`                 | Network (Commons), `sharp`. Check **every** image by eye; ≤ 60 kB each (tested).                                                            |
| `npm run analyze:tracks`    | After editing `scripts/track-sources.ts`, or to re-check URLs | `ffmpeg`/`ffprobe`. Rewrites `src/data/tracks.json`; failing URLs must be fixed or removed.                                                 |
| `npm run og-image`          | After avatar changes                                          | `npm run build && npx vite preview --port 4173` running, plus `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`. |

## Quality checks (before a release)

```sh
npx lighthouse "https://ofekfa.github.io/gudauri-2027/#/game" --form-factor=mobile --only-categories=performance,accessibility,best-practices --quiet --chrome-flags="--headless"
```

Use a literal `#` in hash routes (`%23` 404s). Targets: performance ≥ 90, accessibility 100, axe 0 in light and dark, no overflow at 375 px, the game at 60 fps with 4× CPU throttle.
