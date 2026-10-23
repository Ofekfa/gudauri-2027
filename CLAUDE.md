# CLAUDE.md — Gudauri 2027

Companion site for a 4-person ski trip. Static Preact + TypeScript app on GitHub Pages; a Cloudflare Worker (`/worker`) proxies the AI assistant and serves cached live data (`/itinerary`, `/weather`, `/rates`). The full plan and phase status live in `PLAN.md`.

## Commands

| Command                     | What it does                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`               | Vite dev server at http://localhost:5173/gudauri-2027/                                                                         |
| `npm run lint`              | ESLint + Prettier check (fails CI if unformatted)                                                                              |
| `npm run format`            | Prettier write                                                                                                                 |
| `npm run typecheck`         | `tsc --noEmit` for the app, `scripts/` and `src/sw` (own tsconfigs)                                                            |
| `npm test`                  | Vitest (run once). CI also runs it with `TZ=America/Los_Angeles`.                                                              |
| `npm run build`             | Typecheck + production build to `dist/`                                                                                        |
| `npm run fetch:pistes`      | Regenerate `src/data/pistes.json` from OpenStreetMap (rarely)                                                                  |
| `npm run fetch:rates`       | Bake the latest NBG rate into `src/data/fallbackRates.ts` (the Pages deploy runs it)                                           |
| `npm run analyze:tracks`    | Check every music URL streams; measure duration and loudness into `src/data/tracks.json` (needs ffmpeg)                        |
| `npm run og-image`          | Regenerate the link-preview card `public/og-image.png` (needs a running preview and `CHROME_PATH`); run after changing avatars |
| `npm run fetch:dish-images` | Download, crop and encode dish photos from Wikimedia Commons; review every image by eye before committing                      |

Worker (`cd worker`): `npm test`, `npm run typecheck`, `npx wrangler dev`, `npx wrangler deploy` (normally done by CI, see below), `npx wrangler tail`.

Run lint, typecheck, test and build (and the Worker's tests if you touched it or the shared data) before every PR.

## Architecture

- `src/data/` holds **all trip facts and content data**. `trip.ts` is the single source of truth: times are ISO 8601 with explicit offsets.
- `src/lib/` holds pure, framework-light logic with unit tests (`*.test.ts` next to the file): time, router, storage (`safeStorage`, `versioned`), list helpers (`lib/list`), packing, facts, map, speech and toast.
- `src/components/common/` has reusable list UI (`ProfileSwitcher`, `ProgressSummary`, `BackupPanel`) shared by per-traveler lists.
- `worker/` is the Cloudflare Worker: a route table (`router.ts`) with a shared origin/CORS/method/rate-limit pipeline, and `cache.ts` (`getOrRefresh`: TTL + stale-on-error, KV-backed). It bundles `src/data/**` and some `src/lib/**` (currency, itinerary, weather), so **changes there redeploy the Worker** through `.github/workflows/worker-deploy.yml`. Data routes export `load*` functions that `liveContext.ts` reuses for the assistant's live-data block. Keep that code shared and pure: never import browser-only modules (storage, Preact) into anything the Worker bundles.
- `src/navigation.ts` has route metadata only (titles, icons, tab-bar placement). `src/app.tsx` maps paths to page components.
- `src/components/` has reusable UI; `src/pages/` has one component per route.
- `src/styles/tokens.css` has design tokens (light + dark). Components use tokens only, never raw colors.
- Routing is **hash-based** (`#/flights`) so refresh and deep links never 404 on GitHub Pages.
- Every page except Home, Flights and More is lazy-loaded with dynamic `import()` (`lazyPage`, which forwards props).
- **Shared lists:** `src/lib/sync/` (protocol shared with the Worker; adapters turn packing/to-do state into `item/<list>/<id>` records; `syncClient` sends the diff since the last agreed base and merges the server's changes without losing in-flight edits; `useListSync` drives it). The Worker's `/sync` route uses the `ListsStore` Durable Object (SQLite) behind the `GROUP_CODE` secret. New list features sync by adding an adapter; never send unvalidated server data into a reducer.
- **Album:** predefined moments ("frames") in `src/data/album.ts` (story order; dinners derived from the trip dates), plus **our own moments** added on the site and stored by the Worker. `src/lib/album/` holds:
  - `protocol.ts`, `jpeg.ts` and `moments.ts`, shared with the Worker;
  - `pipeline.ts` (canvas → JPEG, metadata stripped), `queue.ts` (IndexedDB upload queue), `repository.ts`, `token.ts`, `selectors.ts`, `zip.ts`;
  - `service.ts` (module singleton; `AlbumQueueHost` resumes it after reloads).

  On the Worker, `routes/album.ts` and the `AlbumStore` Durable Object (SQLite) hold the photos: an `index` instance for metadata, plus one `frame:<id>` instance per frame for image BLOBs. **Photos never go in git.** Viewing is public (images are `noindex`, immutable). Changes need a token from `POST /album/session`, which takes the group code and returns a token signed with `ALBUM_SIGNING_KEY`.

  **Custom moments.**
  - **Model:** `CustomMoment` is `{ id: "m-" + 10 base-36, title ≤ 40, emoji from MOMENT_EMOJIS, prompt? ≤ 80, orderKey, createdBy, createdAt, custom: true, version }`.
  - **Storage and listing:** stored in the `index` instance (`moments` table) and listed by `GET /album` as `moments`.
  - **Routes:**
    - `POST /album/moments` (`{title, emoji, prompt?, after}`);
    - `PATCH /album/moments/:id` (any of those fields; partial, so concurrent edits of different fields both stay);
    - `DELETE /album/moments/:id` (cascades to its photos, cover and the whole `frame:<id>` image store).
    - Predefined ids get 403. There's a cap of 30 (`MAX_CUSTOM_MOMENTS`). Uploading to a deleted moment returns 410.
  - **Order:** `orderKey` is a base-36 fractional index compared as strings (`keyBetween`). Predefined moments get `"01"`, `"02"`… from their position, and inserting or moving never renumbers anything.
  - **Client:**
    - always use `momentsOf(snapshot)` (merged story order including this phone's unconfirmed changes), never `ALBUM_FRAMES` directly;
    - selectors and `downloadAlbum` take the moment list;
    - optimistic ids start with `tmp-` and can't take photos until saved.

- **Game mechanics:** `engine.ts` stays pure and deterministic (an injected `Random`; the controller seeds `createRng` per run).
  - Entities have a `role` (`obstacle` / `collectible` / `powerup`) in `ENTITY`; a new collectible is magnet-pulled automatically.
  - **Power-ups:** tuning in `POWER_UPS` (`constants.ts`) plus behaviour in `src/game/powerUps.ts` and a sprite. Re-pickup refreshes the timer.
  - **Difficulty:** every number lives in one `DifficultyProfile` (`constants.ts`), read from `state.profile`; never scatter difficulty constants. Density follows time (`pressure()`, `density.fullAfterSeconds`).
  - **Speed:** a two-phase curve (`earlyRamp` to `cruise`, then `lateRamp` to `max`), capped per screen by `MIN_REACTION_SECONDS` (`speedCap`).
  - **Trial presets (temporary):** `PRESETS` plus `#/game?preset=<name>` (`presets.ts`); the score bound takes the most generous one.
  - **Tunnelling:** `fairness.test.ts` keeps `max × FIXED_STEP` under the thinnest hitbox overlap; keep it passing when raising speeds.
  - **Balance changes:** re-run `balance.test.ts` (a bot over 30 seeds; the default's median is 2–3.5 min, between the original and v1.15.0). Anything that adds points (new items, multipliers) must stay inside `maxPlausibleScore`, which reads the item scores and `scoreMultiplier`.
- **Shared game scores:**
  - `src/game/scores.ts` is shared with the Worker: `ScoreEntry {score, achievedAt, runId, playedBy?}`, `mergeTop`/`mergeTables` (dedupe by `runId`, top 5, earlier wins ties), `maxPlausibleScore(seconds)` (derived from `constants.ts`) and `parseScoreSubmission`.
  - `src/game/highScores.ts` has the repository: local (versioned v2 `game:highScores`, migrating the old `{score, at}`) and synced (pending queue `game:pendingScores`, backoff, a one-time upload of existing scores, and `hold()` so nothing goes over the network during a run).
  - `src/game/scoreSync.ts` is the app singleton (re-syncs on `online` and `onAlbumToken`; toasts "🏆 New record for …"). `ScoreSyncHost` flushes pending runs on app load.
  - Worker: `GET /game/scores` (public, `max-age=20`) and `POST /game/scores` (album token, `RL_DATA`, 400 bad shape / 422 implausible, idempotent by `runId`, `playedBy` from the token) on the `ScoresStore` Durable Object (one instance, SQLite, every run kept; top 5 is a query).
- **Background music:** `src/lib/music/` — `machine.ts` (pure reducer; playback is derived, so nothing plays once muted), `shuffleBag.ts`, `settings.ts`, `player.ts` (lazy chunk; owns playback, Media Session) and `musicStore.ts` (always loaded, tiny: creates the single audio element and unlocks it synchronously inside the first gesture, then lazy-loads the player). `src/lib/speech/activity.ts` lets voice features pause/duck music. `MusicControl` sits in the header.
- **Detail routes:** a section takes detail segments via `PARAM_PAGES` in `app.tsx` and `matchRoute` in `hashRouter.ts`. The default is 1 (`#/food/khinkali`); `PARAM_SEGMENTS` raises it (`/album` allows 2: `#/album/<frame>/<photo>`). Exact routes win (`#/album/story`). Navigation, titles and fact pop-ups follow the section (`basePath`). No router library.
- **Offline:** `src/sw/sw.ts` (built to an unhashed `sw.js` by `build/serviceWorkerPlugin.ts`) precaches every built file and `public/` asset; routing logic is in `src/sw/routing.ts` (tested). It never caches the Worker or other origins: live data stays offline-capable through each feature's own versioned copy in storage. The worker must not import app modules (the build fails if it would share a chunk); it has its own tsconfig with WebWorker types. Updates show a sticky "New version available" toast (`src/lib/pwa/register.ts`). `src/data/fallbackRates.ts` is regenerated by `npm run fetch:rates` on each deploy.

## Conventions

- TypeScript strict; no `any`. Typed data models live next to their data.
- No magic numbers: name them as constants (module-level `const` or `constants.ts`).
- **Time:** never use the viewer's local zone for trip times. Parse with `Date.parse(iso)`; display with `formatInZone(iso, airport.timeZone)`. Inject `now` into pure functions for testability.
- **Storage:** only through `src/lib/storage/safeStorage.ts` (`appStore`). It never throws and falls back to memory. Feature state goes behind a repository interface so a backend can replace it. Structured data is stored with `loadVersioned`/`saveVersioned` (inline `version` + migrations).
- **Accessibility:** semantic HTML, every page has one `<h1>` via `PageHeader`, `aria-current="page"` on active nav, visible `:focus-visible`, respect `prefers-reduced-motion`, labels on icon-only controls. Don't use `href="#..."` for in-page anchors (the hash is the router). Write `<label htmlFor>` (not Preact's `for`) so jsx-a11y can verify label/control pairs. Never use `alert`/`confirm`/`prompt`: show inline confirmations or toasts (`src/lib/toast`).
- Comments only where the "why" isn't obvious.
- **Privacy:** first names and public flight info only. No surnames, booking refs, seats, passport or phone data.
- **Secrets:** never in code or git. `.env*` is ignored; document variables in `.env.example`. The Worker uses `wrangler secret put`:
  - `CALENDAR_ICS_URL`;
  - `GROUP_CODE`: shared lists and the album. To rotate it, put a new one; phones re-join with it.
  - `ALBUM_SIGNING_KEY`: rotating it logs every phone out of the album, and they get a new token silently with the stored group code.
- **Content:** facts and dishes are written in our own words, each with `https` sources (dishes need two). Never hotlink or copy the official piste map. Map data comes from OpenStreetMap (ODbL) and needs attribution. Diet flags describe the usual version, conservatively; put variations in `dietNote`.
- **Images:** only from Wikimedia Commons under CC0, public domain, CC BY or CC BY-SA (the script refuses anything else). Pin each file in `scripts/dish-image-sources.ts` with alt text that describes the actual photo, and check every image by eye (Commons categories contain mislabeled photos). Output is AVIF + WebP at 320/640 px, ≤ 60 kB each (tested), in `<picture>` with width/height and `loading="lazy"`. Never hotlink. No suitable photo means the drawn illustration, never a wrong photo. Large media isn't precached; the service worker caches it at runtime.
- **Audio:** only tracks under the licences in `ALLOWED_LICENSES` (`src/data/tracks.ts`), listed in `scripts/track-sources.ts` with licence, source page and attribution; run `npm run analyze:tracks` after changes. Stream from the original host (Commons/archive.org MP3); never commit audio, never re-encode or trim (ND licences). Even out loudness with `gainDb` applied as volume. Load nothing audio-related before the first user gesture, never play after the user muted, respect Save-Data, and skip failing tracks. Third-party players (YouTube) are tap-to-load from official channels only, and background music steps aside while one is open.
- **Licensing and credits:** every third-party asset has its author, licence, licence URL and source recorded in data, and is listed on `#/credits` (and next to the asset where practical). Say what we changed (e.g. "Cropped and resized") for CC BY/BY-SA.

## Gotchas (learned the hard way)

- **The Worker's deploy path filter:** `worker-deploy.yml` redeploys only on `worker/**`, `src/data/**` and the listed `src/lib` paths (including `album/protocol.ts`, `album/jpeg.ts`, `sync/protocol.ts` and `time/countdown.ts`). When the Worker starts bundling a new file, add it to the filter **and** to `worker/tsconfig.json` `include`; until then, run `gh workflow run worker-deploy.yml`.
- **Background queues must never retry silently forever** (the `v1.12.1` album bug: a `501` from `/album/session` was retried with no limit, so the photo sat at "Uploading 0%" and the upload was never sent). Errors that waiting can't fix (not set up, wrong code, not joined, 4xx) fail at once with a reason. Retries are capped (`MAX_ATTEMPTS`), each try has a deadline, and offline time doesn't count. Show a percentage only while bytes are moving. Error responses need CORS headers, or the browser reports status 0 and the client can't tell them from "offline".
- **CORS:** every new request header (e.g. `If-Match`) must be added to `Access-Control-Allow-Headers` in `worker/src/cors.ts`, or browsers block the request while unit tests still pass. Routes with `public: true` skip the origin/CORS pipeline, so set any CORS headers in the handler.
- **Durable Objects:** a new class needs a new `[[migrations]]` tag in `wrangler.toml` (`v1` ListsStore, `v2` AlbumStore, `v3` ScoresStore). The Worker's vitest config aliases `cloudflare:workers` to `worker/test/stubs/cloudflare-workers.ts`. Album rules live in `worker/src/album/logic.ts` so tests can run them in memory.
- **Local end-to-end checks:** `cd worker && npx wrangler dev --port 8787 --var GROUP_CODE:<test> --var ALBUM_SIGNING_KEY:<test>` (test values only), plus `VITE_ASSISTANT_URL=http://localhost:8787 npm run build && npx vite preview --port 4173`. Local Durable Object data persists in `worker/.wrangler/state`; delete it for a clean run. The local rate limiters are real (`RL_DATA` 60/min, `RL_AUTH` 5/min), so poll slowly.
- **Shell editing:** scripted find-and-replace (Python `str.replace`, `sed`) fails silently once Prettier has rewrapped a line. Assert that the pattern exists, or use an exact edit tool. Don't pipe `npm run lint` into `tail` inside `&&` chains (it hides failures). macOS has no `timeout` command.
- **Albums and git:** photos never go in git. Test fixtures are generated (`sharp`) in tests.

## Git workflow

- `main` is protected by convention: work on `feat/*`, `fix/*`, `chore/*`, `docs/*` branches.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`), small and focused.
- `gh pr create` with a description + checklist → CI green → `gh pr merge --squash --delete-branch`.
- Push to `main` deploys to Pages via `.github/workflows/deploy.yml`.
- Tag at the end of each phase (`v0.N.0` in round 1, `v1.N.0` in round 2) and update `PLAN.md` status and `docs/CODEBASE_REPORT.md`.

## Quality bar (checked in Phase 7)

- Lighthouse mobile on every route: performance ≥ 90 and accessibility = 100 (currently 97–100 / 100, best practices 100). Run `npx lighthouse "<url>/#/route"`.
- axe-core: 0 violations on all routes, in light and dark mode and in interactive states.
- No horizontal overflow at 375 px. The game holds 60 fps at 4× CPU throttle.
- Layout shift = 0: lazy pages must not move existing content (the main area reserves viewport height).
- Don't add render-blocking third-party CSS/fonts; self-host assets in `public/`.
