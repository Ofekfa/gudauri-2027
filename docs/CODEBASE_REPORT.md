# Gudauri 2027 — Codebase Report

_Generated 2026-10-22 from the code at `main` @ `b7cb618` (tag `v1.0.0`); **every numbered section re-verified against `main` @ `17fbf1e` (tag `v1.12.0`)**. The changelog below lists what each phase added. Items marked **(unverified)** are informed estimates that need checking._

## Changelog since v1.0.0

### Phase 10.4 — Album cards, custom moments, snowfall (`v1.13.0`)

- **Card carousel (#95):**
  - `components/album/CardCarousel.tsx` and the pure `lib/album/cardCarousel.ts` (start at the cover, `step`, dots up to 5 then "2 / 7", `photoHref`);
  - `useCarousel` gained `keys: 'element'` so a card's ← → don't act page-wide;
  - a new `--tap-target` token (44 px).
- **Custom moments (#96):**
  - `lib/album/moments.ts`, shared with the Worker: `keyBetween` string fractional keys, `mergeMoments`, `keyAfter`, `defaultAfter`, `applyMomentOps`;
  - `CustomMoment` and `parseMomentInput` in `protocol.ts`; a `moments` table in the `index` Durable Object;
  - routes `POST /album/moments`, `PATCH`/`DELETE /album/moments/:id`;
  - `service.momentsOf()` (merged order plus optimistic ops), `queue.failMissing`, and a 410 "This moment was deleted.";
  - the `MomentForm` component; selectors and `downloadAlbum`/`zipPlan` take the moment list;
  - a new `--color-accent-ink` token: the dark-mode danger button contrast went from 2.15 to 8.45:1.
- **Snowfall (#97):** `lib/snowfall/flakes.ts` (`flakeCount`, `makeFlakes`, all constants); `Snowfall` sizes itself on mount and pauses when the tab is hidden.
- **Tests:** 434 site + 88 Worker.

### Phase 10.3 — Album: our trip in photos (`v1.12.0`)

**Routing:**

- **Client:** `matchRoute` takes up to `PARAM_SEGMENTS[base]` detail segments (`/album` allows 2) and passes `params`.
- **Worker:** routes take `:name` path params and several methods per path; 405 and preflight list them all.

**Worker:**

- `worker/src/album/`:
  - `token.ts`: HMAC-SHA256, constant-time verify, expiry max(15 Mar 2027, now + 30 days);
  - `logic.ts`: rules over a storage interface; in memory for tests;
  - `AlbumStore.ts`: Durable Object (SQLite, migration `v2`, binding `ALBUM`); the `index` instance holds photos and frames, `frame:<id>` instances hold image BLOBs.
- `worker/src/routes/album.ts`:
  - session (`RL_AUTH` 5/min);
  - list (now including `moments`);
  - add (multipart, idempotent, JPEG-only, EXIF re-stripped, 30 per frame; 410 for a deleted custom moment);
  - caption and cover (`If-Match` → 409 with `current`);
  - delete, and the public image route;
  - custom moments (`v1.13.0`): `POST /album/moments`, `PATCH`/`DELETE /album/moments/:id`. They validate length, emoji and place, refuse predefined ids (403), cap at 30, and a delete cascades to photos and images.
- CORS allows `If-Match`.

**Site:**

- `src/data/album.ts`: 22 frames.
- `src/lib/album/`: `protocol`, `jpeg`, `moments` (custom moments: order keys, merge, optimistic ops), `pipeline`, `queue`, `repository`, `token`, `uploader`, `cardCarousel`, `selectors`, `zip`, `download`, `service`, `useAlbum`.
- Pages: `AlbumPage`, `AlbumFramePage`, `AlbumStoryPage`.
- Components in `components/album/`: `FrameCard`, `AddPhotoButtons`, `AlbumJoin`, `QuickAdd` (Home, lazy, during the trip), `AlbumQueueHost`, `useCarousel`.
- `components/common/JoinGroupForm.tsx` is shared with `SyncPanel`. Fact pop-ups are off on `/album`.

**Tests:** 404 site + 75 Worker, plus a local end-to-end check (not committed: privacy, offline resume, Undo, viewer, story, Quick add).

**Live:** viewing and adding work since `v1.12.1` (#93). The fix added `uploader.ts`: token errors fail with a reason, there are capped retries with an attempt deadline, and a failed photo shows "Upload failed — tap to retry". `ALBUM_SIGNING_KEY` is set. Tests: 413 site + 79 Worker.

### Phase 10.2 — Avatar hair colours (`v1.11.1`, `v1.11.2`)

- Ron's hair brown, Ofek's light/ash brown; tests keep hair readable against skin and the four colours apart; `og-image.png` regenerated with `npm run og-image`.
- `v1.11.2`: Roi's name spelled correctly (the id stays `roy`).

### Phase 10.1 — Shared lists across our phones (`v1.11.0`)

**Worker**

- `POST /sync` (`worker/src/routes/sync.ts`): Bearer group code compared in constant time with the `GROUP_CODE` secret; 501 until set; `RL_DATA`; size and count caps; `no-store`.
- `worker/src/sync/ListsStore.ts`: a SQLite-backed Durable Object (`LISTS` binding, migration `v1`) that applies each sync in `transactionSync`.
- `worker/src/sync/recordStore.ts`: `applySync`: group-wide revision, last arrival wins per record, tombstones, cap of 3,000 records per doc.
- CORS allows `Authorization`; the Worker's vitest config stubs `cloudflare:workers`.

**Site**

- `src/lib/sync/`: `protocol.ts` (shared), `records.ts`, `adapters.ts` (packing and to-dos), `syncClient.ts` (`sync:<doc>` base/rev/changed-by), `settings.ts` (`sync:settings`), `useListSync.ts` (load, debounced edits, 15 s polling, return/online).
- UI: `components/common/SyncPanel.tsx` (join / status), `ChangedBy.tsx` in packing and to-do rows.

**Tests:** 372 site + 64 Worker.

### Phase 9.2 — Background Georgian music (`v1.10.0`)

**Data**

- `scripts/track-sources.ts` lists 49 tracks: Commons and archive.org MP3 URLs, licence, source page, attribution.
- `scripts/analyze-tracks.ts` (ffprobe/ffmpeg loudnorm, retries) writes `src/data/tracks.json`: `durationS`, `loudnessLufs`, `gainDb`, `checkedOn`.
- `src/data/tracks.ts` types it, with `ALLOWED_LICENSES`.
- `src/data/musicEmbeds.ts` holds 6 official YouTube playlists/videos.

**Engine (`src/lib/music/`)**

- `machine.ts`: phases `waiting|loading|playing|unavailable`; flags `enabled`, `hidden`, `listening`, `speaking`, `external`; `failures`; `trackRequest`. Derived values: `shouldPlay`, `needsTrack(state, served)`, `volumeFactor` (0.2 while speaking), `showsGestureHint`.
- `shuffleBag.ts`: persisted as `music:bag`; one play per cycle; weighted artist spreading with a must-play rule; at most 2 same-era picks preferred.
- `settings.ts`: `music:settings` `{ enabled, volume, chosen }`; default on, off on Save-Data/2G until the visitor chooses.
- `player.ts`: volume = user × 10^(gainDb/20) × duck; next-track metadata preload; 20 s load timeout; retry once, then skip; Media Session.
- `musicStore.ts`: first-gesture unlock with an inline silent MP3, then lazy import of the player.

**UI**

- `components/music/MusicControl.tsx` (header): play/mute, next, now-playing panel, `aria-live` announcements.
- `#/music` (`MusicPage`, `EmbedCard`, `TrackCredits`); `#/credits` lists the tracks too.
- Icons: `music`, `play`, `pause`, `skip`.

**Speech:** `synthesis.ts` reports start/end and `AssistantPage` reports listening to `speechActivity`.

**Bundle:** main +2.4 kB gzipped; player + tracks is a 6 kB gzipped lazy chunk.

**Tests:** 359 site + 55 Worker.

### Phase 9.1 — Georgian food page (`v1.9.0`)

**Router**

- `matchRoute(path, exact, withParam)` and `basePath` in `src/lib/router/hashRouter.ts`: exact routes first, then a section with one URI-decoded detail segment (`/food/:id`).
- `App` has `PARAM_PAGES` (pages get `param`) and uses the section path for titles, tab highlighting and fact pop-up blocking. `lazyPage` forwards props.

**Data**

- `src/lib/food/types.ts`: `Dish` (`name` menu spelling, `nameEn`, `nameKa`, `transliteration`, `category`, `diet` incl. `vegetarianOption`, `dietNote`, `howToEat`, `funFact`, `region`, `emoji`, `sources`, `relatedFactIds`).
- `src/data/dishes.ts`: 38 dishes in 7 categories, with `ORDERING_PHRASE_IDS` (existing `word-*` facts) and `findDish`.
- `src/lib/food/selectors.ts`: `normalize`, `searchDishes`, `filterDishes`, `groupByCategory`. `lastViewed.ts` provides back-navigation focus.

**Images**

- `scripts/fetch-dish-images.ts` + `scripts/dish-image-sources.ts` (pinned Commons files and alt text) use **sharp** (dev) to write `public/food/<id>-{320,640}.{avif,webp}` (≤ 60 kB each) and `src/data/dishImages.json` credits (typed by `dishImages.ts`).
- 34 photos. Penovani, bazhe, qvevri wine and Borjomi use `DishIllustration`.
- **Service worker:** `food/` is excluded from the precache; a runtime cache-first `image` route stores photos in `gudauri-images` (max 120, kept across versions).

**UI**

- `#/food` (More → Fun): search, diet chips, sticky category chips, `DishCard` grid.
- `#/food/<id>`: `FoodDetailPage` with photo credit, related facts, `WordCardBody` ordering phrases (now with a `headingLevel` prop), and sources.
- `#/credits`: all photo and data credits, linked from the footer.
- `PageHeader` has a `back` prop. Fact pop-ups are blocked on `/food`.

**Worker:** `worker/src/dishList.ts` adds a compact dish list (≤ `DISH_LIST_MAX_CHARS` = 2,500; ~2,300 used) to the system prompt.

**Tests:** 280 site + 55 Worker.

### Phase 8.7 — Offline mode + fallback rate (`v1.8.0`)

**Fallback rate:** `scripts/fetch-rates.ts` (`npm run fetch:rates`, run in `deploy.yml` before the build) writes `src/data/fallbackRates.ts` from NBG via the shared `parseNbgResponse`, keeping the old file on failure. `src/lib/currency/fallback.ts` (`bakedPayload`, always stale). `useRates` has status `approximate` (replaces `unavailable`); the Currency page shows a permanent "Approximate: official rate from …" note.

**Service worker**

- `src/sw/routing.ts`: `classify` (shell / precache / network), `cacheNameFor`, `staleCaches`, `SKIP_WAITING`.
- `src/sw/sw.ts`: install precache (`cache: 'reload'`), activate cleanup + `clients.claim()`, message `SKIP_WAITING`, fetch handler. Own `src/sw/tsconfig.json` (WebWorker); excluded from the app tsconfig.
- `build/serviceWorkerPlugin.ts`: emits `sw.js`, injects the precache list (built files + `public/` minus `404.html`, `og-image.png`, font licence) and a SHA-256 content version; fails the build on shared chunks or missing placeholders.
- `src/lib/pwa/register.ts`: production-only registration, update offer when a waiting worker exists and the page is controlled, reload only after Refresh, update check on returning to the foreground. Wired in `main.tsx` with a sticky toast (`durationMs: null`, new in the toast store).
- `public/manifest.webmanifest` + `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.

**Other:** `useHashPath` re-reads the hash after subscribing (race fix). Assistant offline message mentions that the rest of the site works offline. README: offline/install section with iOS caveats.

**Tests:** 194 site + 51 Worker.

### Phase 8.6 — Assistant live context + polish (`v1.7.0`)

**Worker**

- `worker/src/liveContext.ts`: `buildLiveContext(sources, now)` → plan for today and tomorrow (Tbilisi; the first trip days before the trip), weather per zone, rates with ready-made conversions.
  - 1.5 s per source (`LIVE_SOURCE_TIMEOUT_MS`); failures are omitted.
  - `fitToBudget` keeps whole lines in priority order (plan first during the trip; otherwise rates and weather first), max `LIVE_CONTEXT_MAX_CHARS` = 1,500.
  - `cleanText` flattens and caps calendar text at 60 characters.
- `/rates`, `/weather`, `/itinerary` export `loadRates`/`loadWeather`/`loadItinerary`, shared with the live context.
- `buildSystemPrompt(now, live)` adds the block as data, not instructions, and switches the "no live data" rule.
- Imports `src/lib/itinerary/plan.ts` and `src/lib/time/countdown.ts` (both pure).

**Tests:** Worker 51 (+8 live context). Chat tests stub `fetch`.

**Docs:** README (all sections, data credits), worker README (data routes, secrets and bindings, live context), CLAUDE.md (Worker scope, shared-code rule, quality numbers).

### Phase 8.5 — Weather, snow & webcams (`v1.6.0`)

**Data:** `src/data/zones.ts`: Village 2,000 m, Mid-mountain 2,700 m, Top 2,950 m, with YouTube cam ids and `checkedOn` dates.

**Worker**

- `GET /weather` (`worker/src/routes/weather.ts`): one Open-Meteo call for all zones; cache key `weather:v1`, TTL 30 min, max stale 24 h; `RL_DATA`; browser `max-age=300`; 503 when nothing usable.
- Tests use a real captured response (`worker/test/fixtures/open-meteo-2026-10-22.json`, excluded from Prettier).

**Shared:** `src/lib/weather/` (`openMeteo.ts` URL/validation/summary, `types.ts`, `codes.ts` WMO table, `validate.ts`), imported by the Worker via its tsconfig.

**Site**

- `src/lib/weather/{weatherClient,useWeather,graphic}.ts`: `weather:last` offline copy; graphic geometry.
- `components/weather/MountainZones.tsx` (original SVG with `<title>`/`<desc>`) and `WebcamCard.tsx` (tap-to-load youtube-nocookie, unmounts when off-screen or hidden).
- `#/weather` is **in the tab bar** (Home · Itinerary · Packing · Weather · More); Game moved to More → Fun.
- Icons: `cloudSnow`, `video`.

**Tests:** 186 site + 43 Worker.

### Phase 8.4 — Itinerary (`v1.5.0`)

**Worker**

- `GET /itinerary` (`worker/src/routes/itinerary.ts`):
  - Secret `CALENDAR_ICS_URL` (501 until set).
  - Window 2027-02-23…03-01 in Tbilisi time.
  - Cache key `itinerary:v1`: TTL 20 min, max stale 7 days. Limiter `RL_DATA`; browser `max-age=60`.
- `worker/src/itinerary/ics.ts`:
  - A text pre-filter, then **ical.js** (Worker-only dependency) for TZID, all-day, RRULE, EXDATE and RECURRENCE-ID.
  - Whitelisted output only; ids are an FNV hash.

**Shared:** `src/lib/itinerary/types.ts` (payload + validator).

**Site**

- `src/lib/itinerary/`: `plan.ts` (days, flight merge/de-dup, Tbilisi-day grouping, now/next), `itineraryClient.ts` (`itinerary:last` offline copy), `useItinerary.ts`.
- `#/itinerary` is **in the tab bar** (Home · Itinerary · Packing · Game · More); Flights moved to More → Plan.
- Home: during the trip, `TodayPlan` replaces the countdown's companion card.
- Icon: `calendar`.

**Tests:** 174 site + 39 Worker.

### Phase 8.3 — Pre-flight to-do list (`v1.4.0`)

**`src/lib/todo/`**

- `model.ts`:
  - `TodoListId` = traveler | `'shared'`;
  - 5 categories;
  - `TodoItem { id, title, note?, done, dueBy?, category, templateKey?, createdAt }`;
  - `TodoState` v1.
- `reducer.ts`, `selectors.ts` (`sortTodos`, `filterTodos`, `nextDue`, `dueStatus` in Israel calendar days), `importExport.ts` (app id `gudauri-2027/todo`).
- `repository.ts`: key `todo`, `loadVersioned`, plus `loadTodoStateSync` for first paint.
- `due.ts`: `formatDue`, date-input conversions, Israel time.
- `useTodo.ts`.

**Starter template** (`src/data/todoTemplate.ts`, `personalTemplate`/`sharedTemplate`): deadlines are derived from `trip.ts`.

**Components**

- `components/todo/`: `TodoRow`, `TodoAddForm`, `profiles.tsx` (`TODO_PROFILES` adds Shared), `NextTodos` (Home card, before phase).
- `components/common/TemplateOffer.tsx`, now generic.
- `ProfileSwitcher` grid sizes to the profile count.

**Router and packing**

- `parseHashQuery`, `href(path, params)`.
- Packing honours `?who=&status=`.

**Time:** `zoneOffsetMinutes`, `zonedTimeToIso` in `lib/time/format.ts`.

**Route:** `#/todo` (lazy, More → Plan); fact pop-ups blocked there.

**Tests:** 164 site + 28 Worker.

### Phase 8.2 — Currency converter (`v1.3.0`)

**Worker**

- `GET /rates` (`worker/src/routes/rates.ts`):
  - NBG unfiltered JSON → GEL per unit (ILS quantity 10). Fallback: open.er-api.com (attribution required).
  - `getOrRefresh` with key `rates:v1`, TTL 12 h, max stale 7 days.
  - `RL_DATA` 60/min; `Cache-Control: max-age=600`.
  - Payload `{ base, gelPer:{ILS,EUR}, validFrom, source, fetchedAt, stale }`.
- New bindings: `CACHE` (KV, id `3587a739aace4a73a4b2f88477cb2d41`) and `RL_DATA` (namespace 1002).
- `worker/src/upstream/fetchJson.ts`: 8 s timeout, User-Agent.
- `clearMemoryCache()` for tests.

**Shared (`src/lib/currency/`)**

- `rates.ts`: parsers for both sources, validators, bounds. Used by the site and the Worker; changes trigger a Worker deploy.
- `convert.ts`: `convert`, `parseAmount`, `friendlyRound`, `quickTable`, `formatMoney`.
- `ratesClient.ts`: fetch + versioned `currency:rates` cache.
- `useRates.ts`.

**Site**

- `src/lib/worker/config.ts`: `WORKER_URL`, now also used by the assistant client.
- `formatDay`/`formatAgo` in `lib/time/format.ts`.
- `#/currency` (lazy, More → Tools); fact pop-ups blocked there.

**Tests:** 144 site + 28 Worker.

### Phase 8.1 — Georgian words (`v1.2.0`)

**Data**

- `src/data/words.ts`: 27 `WordFact`s (word in Mkhedruli, national romanization, meaning, optional note and pronunciation tip, Wiktionary source).
- `FACTS` = `GENERAL_FACTS` (55) + `WORDS` (27) = **82**.

**Types**

- `FACT_TOPICS` gains `'words'` ("Georgian words", 🗣️).
- `Fact = GeneralFact | WordFact`, with `isWordFact`.

**UI**

- `components/facts/WordCard.tsx` renders the word body inside the FactsPage card.
- `:lang(ka)` uses a system font stack in `global.css`.

**Speech**

- `lib/speech/voices.ts` (`findVoice`) and `useVoice.ts` (re-checks on `voiceschanged`).
- `speakWithVoice` in `synthesis.ts`. The "Hear it" button only appears with a real `ka*` voice.

**Worker**

- Picked the words up automatically: the first CI-driven deploy, triggered by `src/data/**`.
- Verified live: "How do I say thank you in Georgian?" → "მადლობა (madloba)".

**Tests:** 114 site + 22 Worker.

### Phase 8.0 — Foundations (`v1.1.0`)

**Navigation**

- Sections carry `group: 'plan' | 'tools' | 'fun'` (`GROUP_LABEL`, `MORE_GROUPS` in `src/navigation.ts`).
- The **desktop header shows the same 5 items as the mobile tab bar** (`TAB_BAR_ITEMS`), with More highlighted for sections under it.
- The More page is grouped by heading.
- The tab bar is still Home · Flights · Packing · Game · More. Itinerary and Weather replace Flights and Game in 8.4/8.5.

**Worker**

- `worker/src/router.ts` is a route table with a shared pipeline: path → origin → preflight → method → per-route per-IP rate limit → handler. Routes live in `worker/src/routes/`, with helpers in `cors.ts` and `http.ts`; types are in `env.ts` (`RATE_LIMITER`, `RL_DATA?`, `CACHE?`).
- `worker/src/cache.ts`: `getOrRefresh` (TTL + stale-on-error + validation), backed by KV when `CACHE` is bound, plus an isolate memory layer. The Cache API isn't used, since it's only documented for custom domains.
- `/health` and `/chat` behaviour is unchanged; verified live.

**Worker CI deploy**

- `.github/workflows/worker-deploy.yml` deploys on pushes to `main` touching `worker/**`, `src/data/**`, `src/lib/facts/types.ts` or `src/lib/{weather,itinerary,currency}/**`.
- It uses `cloudflare/wrangler-action@v4` with the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
- Without the secrets it tests and skips the deploy with a warning. The secrets were set on 2026-10-21, so Worker deploys now run in CI.

**List toolkit**

- `src/lib/list/`: `ids`, `text` (`normalizeText`), `backup` (`ParseResult<T>`, `backupFileName`).
- `src/components/common/`:
  - `ProfileSwitcher<Id>`, with `profiles` and `TRAVELER_PROFILES`;
  - `ProgressSummary`;
  - `BackupPanel<T>`, with injected `serialize`/`parse`.
- Packing uses all of them; behaviour and stored data are unchanged (regression-tested).

**Storage**

- `src/lib/storage/versioned.ts`: `loadVersioned`/`saveVersioned`, with an inline `version`, migrations and statuses `empty | ok | migrated | corrupt | future`.
- The packing repository adopts it, with the same format.

**Facts**

- `BaseFact` / `GeneralFact` / `Fact` union in `src/lib/facts/types.ts`; `WordFact` joins in 8.1.

**Housekeeping**

- Stale `PLAN.md` and `CLAUDE.md` lines fixed.
- The Worker is on TypeScript **6.0.3**, the same as the site.
- `jsdom` removed.
- The CSP decision is recorded in `PLAN.md`: none for now.
- Lesson: in-place `npm install` can drop optional platform bindings from a lockfile (npm/cli#4828). Regenerate it from scratch if CI reports "Cannot find native binding".

**Tests:** 107 site + 22 Worker.

## 1. Overview

**Repo, URL and state**

- Repo: `github.com/Ofekfa/gudauri-2027` (public). Default branch `main`.
- 91 squash-merged PRs. 24 tags: `v0.1.0`, `v0.1.1`, `v0.2.0`–`v0.6.0`, `v1.0.0`–`v1.12.0`, plus patches `v1.5.1`, `v1.10.1`, `v1.11.1`, `v1.11.2`. GitHub Releases: `v1.0.0`, `v1.7.0`, `v1.8.0`.
- Live site: https://ofekfa.github.io/gudauri-2027/
- Worker (AI proxy + data, sync and album routes): `https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev`
- `PLAN.md`: phases 1–7, 8.0–8.7, 9.1–9.2 and 10.1–10.3 are done.
- Live Worker status (checked 2026-10-22, after `v1.12.1`): `/album` lists (empty after the live test photos were deleted); `/sync` answers 401 without a code, so `GROUP_CODE` is set; `POST /album/session` answers 401 for a wrong code, because `ALBUM_SIGNING_KEY` is set.
- Open item: hands-on testing on real phones (iOS Safari speech, camera/HEIC uploads, Android Chrome, game touch steering).

**Stack and versions** (from `package.json` / `worker/package.json`)

| Area        | Choice                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework   | **Preact 11** (`preact ^11.0.1`), the **only runtime dependency** of the site                                                                                           |
| Language    | TypeScript **6.0.3** in both the site and `worker/`                                                                                                                     |
| Build       | Vite 8 + `@preact/preset-vite`; `build/serviceWorkerPlugin.ts` emits `sw.js`                                                                                            |
| Tests       | Vitest 5 (`environment: 'node'`, no DOM library)                                                                                                                        |
| Lint/format | ESLint **9** (pinned: `eslint-plugin-jsx-a11y` doesn't support 10), `typescript-eslint`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier`, Prettier 3                 |
| Dev tools   | `sharp` (dish images), `puppeteer-core` (`og-image`), `@types/node`                                                                                                     |
| Node        | `engines: >=22`; CI uses Node 22; scripts are `.ts` run natively by `node`                                                                                              |
| Worker      | Wrangler 4.151, `@cloudflare/workers-types`, Vitest 5; runtime dependency `ical.js` 2.2 (calendar parsing); Durable Objects via `cloudflare:workers` (stubbed in tests) |

There's no router library, state library, CSS framework, date library or icon library: everything is in-house.

**Deviations from the original brief** (also listed in `PLAN.md` → "Deviations")

- **Navigation:**
  - The router is in-house (hash-based).
  - "More" is a page (`#/more`), not a pop-up sheet.
- **Map data:** comes from **Overpass/OSM**, not OpenSkiMap downloads (the worldwide files are too large). OpenSkiMap is credited and linked.
- **Packing:**
  - Lists started **per-device** by Ofek's choice; since `v1.11.0` they (and the to-dos) can sync across our phones with the group code.
  - The starter template defaults every item to "Already have".
- **Fun facts:**
  - 55 facts (beating the 40+ target) plus 27 Georgian words = 82.
  - The Facts page shows **one fact at a time** (swipe / ← → / buttons), per feedback.
- **Game:** flags are obstacles, not slalom gates.
- **Assistant:**
  - The proxy uses **Cloudflare Workers AI** with no API key.
  - The planned per-IP **daily cap was dropped**: the free rate limiter only supports 10 s/60 s windows and is approximate.
  - The Groq fallback was documented in planning but **not implemented**.
- **Avatars:** changed after feedback (Maya: brown eyes + glasses; Roi: undercut; Ofek: warmer skin). Phase 10.2 (`v1.11.1`): Ron's hair brown, Ofek's light/ash brown; tests keep hair readable against skin and all four hair colours apart; `og-image.png` comes from `scripts/og-image.mjs`. `v1.11.2` spells Roi's name correctly (the id stays `roy`).
- **Phase 7:** the font is self-hosted (Fredoka, OFL), replacing Google Fonts, for performance.

## 2. Structure

```
.
├─ .github/workflows/        ci.yml (PR checks), deploy.yml (Pages on push to main), worker-deploy.yml (Worker on push to main, path-filtered)
├─ build/serviceWorkerPlugin.ts  emits sw.js with the precache list + content version
├─ docs/                     CODEBASE_REPORT.md (this report)
├─ public/                   copied verbatim to dist/
│  ├─ 404.html               GitHub Pages fallback → redirects to /gudauri-2027/
│  ├─ favicon.svg, apple-touch-icon.png, og-image.png, manifest.webmanifest, icon-192/512/maskable-512.png
│  ├─ fonts/                 fredoka-latin.woff2 (variable 500–700) + Fredoka-OFL.txt
│  └─ food/                  <dish>-{320,640}.{avif,webp} (34 photos; runtime-cached, not precached)
├─ scripts/                  Node scripts (own tsconfig): fetch-pistes, fetch-rates, fetch-dish-images (+ dish-image-sources),
│                            analyze-tracks (+ track-sources), og-image.mjs, lib/geometry.ts(+test)
├─ src/
│  ├─ main.tsx               bootstrap: CSS, render <App/>, service worker registration + update toast
│  ├─ app.tsx                shell: PAGES, PARAM_PAGES, PARAM_SEGMENTS, global widgets
│  ├─ navigation.ts(+test)   route metadata (titles, icons, groups, tab-bar placement)
│  ├─ assistant/             client.ts(+test): fetch to the Worker, error mapping
│  ├─ avatars/               FaceArt.tsx, Avatar.tsx (AvatarFace, AvatarSkier)
│  ├─ components/            shared UI (Header, BottomTabBar, PageHeader, Icon, ToastHost, Countdown, FlightCard, Crew, SectionCards, Snowfall, Footer)
│  │  ├─ album/              FrameCard, AddPhotoButtons, AlbumJoin, QuickAdd, AlbumQueueHost, useCarousel
│  │  ├─ common/             ProfileSwitcher, ProgressSummary, BackupPanel, TemplateOffer, SyncPanel, JoinGroupForm, ChangedBy
│  │  ├─ facts/              FactPopups, WordCard
│  │  ├─ food/               DishCard, DishPhoto, DishIllustration, DietBadges
│  │  ├─ itinerary/          EntryList, TodayPlan
│  │  ├─ map/                PisteMapSvg, MapBackground
│  │  ├─ music/              MusicControl, EmbedCard, TrackCredits
│  │  ├─ packing/            AddItemForm, PackingItemRow, FilterBar
│  │  ├─ todo/               TodoRow, TodoAddForm, NextTodos, profiles
│  │  └─ weather/            MountainZones, WebcamCard
│  ├─ data/                  trip, characters, facts, words, packingTemplate, todoTemplate, pistes.json, zones, dishes,
│  │                         dishImages(.json), tracks(.json), musicEmbeds, fallbackRates, album (+tests)
│  ├─ game/                  canvas game: constants, engine (pure), render, sprites, input, controller, highScores (+tests)
│  ├─ lib/                   pure logic, framework-light, unit-tested
│  │  ├─ album/              protocol, jpeg, pipeline, queue, repository, token, uploader, selectors, zip, download, service, useAlbum
│  │  ├─ currency/           rates (shared with Worker), convert, fallback, ratesClient, useRates
│  │  ├─ facts/              types, rotation, settings, carousel
│  │  ├─ food/               types, selectors, lastViewed
│  │  ├─ itinerary/          types + plan (shared with Worker), itineraryClient, useItinerary
│  │  ├─ list/               ids, text, backup
│  │  ├─ map/                types, catalog
│  │  ├─ music/              machine, shuffleBag, settings, player, musicStore, useMusic
│  │  ├─ packing/, todo/     model, reducer, selectors, importExport, repository, use* (+ todo/due)
│  │  ├─ pwa/                register (service worker + update offer)
│  │  ├─ router/             hashRouter, lazyPage
│  │  ├─ speech/             recognition, synthesis, voices, useVoice, activity
│  │  ├─ storage/            safeStorage, versioned
│  │  ├─ sync/               protocol (shared with Worker), records, adapters, syncClient, settings, useListSync, useSyncSettings
│  │  ├─ time/               countdown, format, useNow
│  │  ├─ toast/              toastStore
│  │  ├─ weather/            openMeteo, types, codes, validate (shared), weatherClient, useWeather, graphic
│  │  └─ worker/             config (WORKER_URL)
│  ├─ pages/                 one component per route (see §3)
│  ├─ styles/                tokens.css (tokens + @font-face + dark mode), global.css (all component CSS, ~3,190 lines)
│  └─ sw/                    sw.ts, routing.ts(+test), own tsconfig (WebWorker)
├─ worker/                   Cloudflare Worker (separate npm package)
│  ├─ src/index.ts           route list + exports of the Durable Object classes
│  ├─ src/router.ts          route table + shared pipeline; src/cors.ts, http.ts, env.ts, limits.ts, cache.ts
│  ├─ src/routes/            health, chat, rates, itinerary, weather, sync, album
│  ├─ src/album/             token, logic, AlbumStore (Durable Object)
│  ├─ src/sync/              recordStore, ListsStore (Durable Object)
│  ├─ src/itinerary/ics.ts, src/upstream/fetchJson.ts, src/prompt.ts, src/dishList.ts, src/liveContext.ts
│  ├─ test/                  10 test files, fixtures/, stubs/cloudflare-workers.ts
│  ├─ wrangler.toml          bindings + vars + migrations
│  └─ README.md              setup/deploy guide
├─ index.html                Vite entry: meta/OG tags, manifest, font preload, #app
├─ vite.config.ts            base '/gudauri-2027/', preact + service worker plugins
├─ vitest.config.ts          src/**/*.test.ts(x), scripts/**/*.test.ts
├─ eslint.config.js, .prettierrc, .prettierignore, tsconfig.json
└─ CLAUDE.md, README.md, PLAN.md, LICENSE (MIT), .env.example
```

**Bootstrap flow**

1. `index.html` loads `/src/main.tsx`.
2. `main.tsx` imports the CSS, calls `render(<App/>)` into `#app` and registers the service worker (production only).
3. `App` reads the hash path through `useHashPath()`, resolves it with `matchRoute` and sets `document.title` from the section.
4. `App` renders the global layers, in this order:
   - skip-link button
   - `MapBackground` (lazily imports `pistes.json`)
   - `Snowfall`
   - `Header` (includes `MusicControl`)
   - `<main key={path}>` with the page
   - `Footer`
   - `ToastHost`
   - `AlbumQueueHost` (loads album code only if uploads are pending)
   - `FactPopups` (lazily imports `facts.ts`)
   - `BottomTabBar`

## 3. Routing & navigation

**How routing works**

- It's hash-based: `#/flights`. GitHub Pages never sees the path, so refresh and deep links work. `public/404.html` redirects unknown real paths to the root.
- `src/lib/router/hashRouter.ts`:
  - `parseHash()` strips the query and any trailing slash. Anything that doesn't start with `/` maps to `/`.
  - `parseHashQuery()` reads `?…` after the route; `href(path, params?)` builds `#path?query`.
  - `useHashPath()` listens to `hashchange` and re-reads the hash after subscribing.
  - `basePath(path)`: `/food/khinkali` or `/album/snowman/<photo>` → the section (`/food`, `/album`); 1–2 detail segments (`MAX_DETAIL_SEGMENTS = 2`).
  - `matchRoute(path, exact, withParam, maxSegments)`: exact routes first, then a section page with up to `maxSegments[base]` URI-decoded segments (default 1); deeper paths or bad encoding → no match.
- `src/app.tsx`:
  - `PAGES` (exact): `/`, `/flights`, `/more` are eager; `/game`, `/map`, `/packing`, `/facts`, `/assistant`, `/currency`, `/todo`, `/itinerary`, `/weather`, `/food`, `/credits`, `/music`, `/album`, `/album/story` use `lazyPage(() => import(...))` (`src/lib/router/lazyPage.tsx`: "Loading…" and error-with-retry, forwards props).
  - `PARAM_PAGES`: `/food` → `FoodDetailPage`, `/album` → `AlbumFramePage` (`#/album/<frame>` and `#/album/<frame>/<photo>`). They get `param` (first segment) and `params` (all).
  - `PARAM_SEGMENTS = { '/album': 2 }`.
  - The section path (`route.base`) drives titles, tab highlighting and fact pop-up blocking.
- Unknown paths: `ComingSoonPage` if a nav item is flagged `comingSoon` (none is), otherwise `NotFoundPage`.
- On `hashchange`, `App` sets `body.dataset.navigated` and scrolls to the top. `PageHeader` then focuses the page `<h1>`.

**Steps to add a page**

1. Create `src/pages/XPage.tsx`. Use `export default` if it should be lazy-loaded. Start it with `<PageHeader title=… subtitle=…/>` (optional `back`) for the `<h1>`, back link and focus handling.
2. Add a `SectionItem` to `SECTIONS` in `src/navigation.ts` with `path`, `group` (`plan`/`tools`/`fun`), `title`, `navLabel`, `icon` (an `IconName` from `src/components/Icon.tsx`), `blurb` and `inTabBar`.
3. Register it in `PAGES` (or `PARAM_PAGES` + `PARAM_SEGMENTS` for detail routes) in `src/app.tsx`.
4. If it should never show fact pop-ups, add the path to `BLOCKED_PATHS` in `src/components/facts/FactPopups.tsx` (now `/game`, `/facts`, `/currency`, `/todo`, `/food`, `/album`).
5. Update `src/navigation.test.ts` if tab-bar membership changes. It asserts exactly **5** tab-bar items: Home first, More last.

**Nav UI today**

- **Mobile bottom tab bar** (`BottomTabBar.tsx`, under 56rem): a fixed 5-column grid, Home · Itinerary · Packing · Weather · More. It is **full**.
- **More page** (`#/more`): cards grouped by `MORE_GROUPS`:
  - Plan: Flights, To-do.
  - Fun: Food, Album, Music, Credits, Game, Facts.
  - Tools: Currency, Map, Assistant.
  - The More tab lights up for all of them (`activeTabPath`).
- **Desktop header nav** (`Header.tsx`, 56rem and up): the same 5 `TAB_BAR_ITEMS`, so it never overflows.
- **Home "Explore" cards** (`SectionCards`) list all `SECTIONS`. During the trip Home also shows `TodayPlan` and the lazy `QuickAdd` album card.

## 4. Data & config

**Trip config: `src/data/trip.ts`** (single source of truth; the Worker bundles it)

- Types: `TravelerId = 'ofek' | 'ron' | 'roy' | 'maya'`, `Traveler { id, name }`, `Airport { iata, name, city, zoneLabel, timeZone }`, `Baggage`, `FlightLeg { flightNo, carrier, from, to, departure, arrival (or TBC), baggage?, meal? }`, `Trip { name, resort, country, hotel, destinationTimeZone, firstDay, lastDay, travelers, outbound, inbound }`.
- Values:
  - Name "Gudauri 2027", resort Gudauri, country Georgia, hotel "Marco Polo Hotel, Gudauri".
  - `destinationTimeZone`: `Asia/Tbilisi`. Days `2027-02-24`…`2027-02-28`.
  - Travelers: Ofek, Ron, Roi (id `roy`), Maya.
  - Outbound: El Al **LY5107**, TLV (Ben Gurion, `Asia/Jerusalem`) → TBS (`Asia/Tbilisi`). Departs `2027-02-24T05:15:00+02:00`, arrives `2027-02-24T09:50:00+04:00`.
  - Return: **LY5110**, TBS → TLV. Departs `2027-02-28T23:55:00+04:00`, arrives `2027-03-01T00:35:00+02:00`.
  - Baggage (`BAGGAGE_PER_TICKET`, both legs): carry-on 3 kg, checked 23 kg, trolley 8 kg. Meal: no.

**Content data files** (`src/data/`)

| File                                    | Contents                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `characters.ts`                         | Avatar traits per traveler                                                                  |
| `facts.ts` + `words.ts`                 | 55 general facts + 27 `WordFact`s = 82 `FACTS`                                              |
| `packingTemplate.ts`, `todoTemplate.ts` | 37 packing starter items; personal and shared to-do templates (deadlines derived from trip) |
| `pistes.json`                           | Map data (§6)                                                                               |
| `zones.ts`                              | 3 weather zones (2,000 / 2,700 / 2,950 m) with webcam ids                                   |
| `dishes.ts`, `dishImages.ts(.json)`     | 38 dishes in 7 categories; 34 photo credits                                                 |
| `tracks.ts(.json)`, `musicEmbeds.ts`    | 49 music tracks with licence and loudness; 6 YouTube embeds                                 |
| `fallbackRates.ts`                      | Baked NBG rate, regenerated on each Pages deploy                                            |
| `album.ts`                              | 22 album frames (below)                                                                     |

**Album data** (`src/data/album.ts`)

- `AlbumFrame { id (URL slug), title, prompt, emoji, dateHint?, bonus? }`.
- `ALBUM_FRAMES`, in story order: McDonald's before the flight, the flight (LY5107), taxi, first snow, snowman, snowball fight, skiing, gondola, 5 dinners (`dinnerFrames(firstDay, lastDay)` → `dinner-2027-02-24` … `dinner-2027-02-28`), lunch beer, bowling, snooker, pool, bar, the flight home (LY5110), then 3 **bonus** frames (the four of us, best view, funniest moment).
- `PLANNED_FRAMES` = the 19 non-bonus frames (progress counts only these). `findFrame(id)`.
- Constants: `MAX_PHOTOS_PER_FRAME = 30`, `MAX_CAPTION_CHARS = 120`.

**Album wire format** (`src/lib/album/protocol.ts`, shared with the Worker)

- `AlbumPhoto { id, frameId, uploadedBy: TravelerId, uploadedAt (ISO), caption?, width, height, thumbWidth, thumbHeight, version }`; `version` is bumped on caption edits.
- `AlbumFrameState { coverPhotoId?, version }`; `version` 0 before the first cover change.
- `AlbumListing { frames: Record<frameId, AlbumFrameState>, photos: AlbumPhoto[] }`.
- `UploadMeta` = `AlbumPhoto` without `frameId`, `version`, `caption`. Note `uploadedBy` comes from the phone's meta, not from the token.
- Limits: `MAX_FULL_BYTES` 1,600,000, `MAX_THUMB_BYTES` 150,000, `MAX_UPLOAD_BYTES` = sum + 20,000, `MAX_IMAGE_EDGE` 4096. `PHOTO_ID = /^[A-Za-z0-9-]{8,64}$/` (the client uses `crypto.randomUUID()`).
- Validators: `cleanCaption` (control chars removed, whitespace collapsed, ≤ 120), `parseUploadMeta`, `parseListing` (drops unknown frames and bad photos), `parsePhotoResponse`.

**Times and timezones** (no library, only `Intl`)

- All instants are ISO strings with offsets, parsed with `Date.parse`. Display always passes an explicit IANA zone. The viewer's own zone is never used.
- `src/lib/time/format.ts`: `formatInZone(iso, tz) → { time, date, offset }` (date assembled from `formatToParts`), plus `utcOffsetLabel`, `formatDuration`, `formatDayRange`, `formatDay`, `formatAgo`, `zoneOffsetMinutes`, `zonedTimeToIso`.
- `src/lib/time/countdown.ts`: `getTripPhase(nowMs, trip)` → `before | during (day X of N, Tbilisi date) | after`; `splitDuration`, `localDateIn`, `daysBetween`, `tripTotalDays`. Bundled by the Worker.
- `src/lib/time/useNow.ts`: re-renders on wall-clock second boundaries.
- Tests run under the host zone **and** `TZ=America/Los_Angeles` in CI.

**Fun facts and words** (`src/lib/facts/types.ts`)

- `FACT_TOPICS = ['gudauri','resort','georgia','food','skiing','beginner','words']`; `TOPIC_LABEL` / `TOPIC_EMOJI` are `Record`s, so a new topic must be labelled.
- `BaseFact { id, title, text, source }`; `GeneralFact` (any topic but words); `WordFact` (`word`, `transliteration`, `meaning`, `note?`, `pronunciation?`); `Fact = GeneralFact | WordFact`, `isWordFact`.
- Facts per topic: gudauri 8 · resort 9 · georgia 12 · food 11 · skiing 7 · beginner 8 (55) · words 27.
- `facts.test.ts`: ≥ 40 facts with unique ids, ≥ 5 per topic, `text` ≤ 220 characters, non-empty `title`, `https` source. `words.test.ts` covers the word fields.
- **Rotation** (`rotation.ts`): shuffle bag (once per cycle, never twice in a row); first pop-up after 20 s, then 45 s + up to 45 s jitter; `shouldShowFact` blocks when muted, hidden or on a blocked route.
- **Scheduler** (`components/facts/FactPopups.tsx`): lazily imports `FACTS`, checks every 5 s, shows a 12 s toast with a Mute action.
- **Facts page:** topic chips, one-card viewer (`carousel.ts`), Surprise me, pop-up switch; word cards via `WordCard` with "Hear it" only when a real `ka*` voice exists.
- Georgian script falls back to system fonts (`:lang(ka)`); Fredoka is Latin only.

## 5. State & storage

**Storage interface: `src/lib/storage/`**

- `safeStorage.ts`: `KeyValueStore { get, set, remove }`; `createSafeStore` wraps `localStorage` in try/catch and **falls back to an in-memory Map**, so it never throws. Singleton `appStore`; every key gets the prefix **`gudauri2027:`**.
- `versioned.ts`: `loadVersioned(store, spec)` / `saveVersioned` with an inline `version`, `validate`, `empty`, optional migrations, and statuses `empty | ok | migrated | corrupt | future`.

**Keys in use** (all through `appStore`)

| Key                                  | Owner                                      | Value                                       |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------- |
| `packing`                            | `lib/packing/repository.ts` (versioned)    | `PackingState`                              |
| `packing:profile`                    | `PackingPage`                              | last selected traveler                      |
| `todo`                               | `lib/todo/repository.ts` (versioned)       | `TodoState`                                 |
| `todo:profile`                       | `TodoPage`, `NextTodos`                    | last selected list                          |
| `facts:muted` / `facts:lastShownAt`  | `lib/facts/settings.ts`                    | `'true'/'false'` / epoch ms                 |
| `game:highScores` / `game:character` | `game/highScores.ts` / `GamePage`          | top-5 per character / last pick             |
| `assistant:speak`                    | `AssistantPage`                            | `'true'/'false'`                            |
| `currency:rates`                     | `lib/currency/ratesClient.ts` (versioned)  | last rates payload                          |
| `itinerary:last`                     | `lib/itinerary/itineraryClient.ts` (vers.) | last itinerary payload                      |
| `weather:last`                       | `lib/weather/weatherClient.ts` (versioned) | last weather payload                        |
| `music:settings` / `music:bag`       | `lib/music/settings.ts` / `player.ts`      | `{ enabled, volume, chosen }` / shuffle bag |
| `sync:settings`                      | `lib/sync/settings.ts` (versioned)         | `{ code, me }` (group code, whose phone)    |
| `sync:packing` / `sync:todo`         | `lib/sync/syncClient.ts` (versioned)       | last agreed base, revision, changed-by      |
| `album:token`                        | `lib/album/token.ts` (versioned)           | `{ token, expiresAt, who }`                 |
| `album:pending`                      | `lib/album/service.ts`, `AlbumQueueHost`   | `'1'` while uploads wait                    |

- **IndexedDB** (outside `appStore`): database `gudauri-album`, object store `uploads` (keyPath `id`) holds queued photos with their Blobs (`lib/album/queue.ts`); falls back to memory if IndexedDB is unavailable.
- Service worker caches: `gudauri-precache-<version>` and `gudauri-images` (§9).

**Packing and to-do models**

- Packing (`src/lib/packing/`): `PackingState { version: 1, lists: Record<TravelerId, PackingItem[]>, templateDecided }`; `PackingItem { id, name, category, ownership, packed, createdAt }`; 80-character names, 300 items per list. Pure `packingReducer`, selectors, tagged JSON export/import (`gudauri-2027/packing`), `PackingRepository` over `loadVersioned`, `usePacking`.
- To-do (`src/lib/todo/`): `TodoListId` = traveler | `'shared'`; `TodoItem { id, title, note?, done, dueBy?, category, templateKey?, createdAt }`; same structure as packing (reducer, selectors, `importExport` app id `gudauri-2027/todo`, repository, `useTodo`), due dates in Israel calendar days.
- Both use the shared list toolkit (`lib/list/`, `components/common/`).

**Sync** (`src/lib/sync/`, since `v1.11.0`)

- Joining: `JoinGroupForm` (in `SyncPanel` and `AlbumJoin`) stores the group code and "whose phone" in `sync:settings`; the code stays on the phone.
- `adapters.ts` turn packing/to-do state into `item/<list>/<id>` records (docs `packing`, `todo`); `records.ts` validates them.
- `syncClient.ts` sends the diff since the last agreed base to `POST /sync` and merges the server's changes without losing in-flight edits; `ChangedBy` shows who last changed a row.
- `useListSync.ts`: load, 1.5 s debounce after edits, 15 s polling, and a sync on return to the tab or coming online.
- Worker side: `ListsStore` Durable Object, last arrival wins per record, tombstones, 3,000 records per doc (§7).

**Album state** (`src/lib/album/`)

- **Token** (`token.ts`): `getAlbumToken()` needs `sync:settings` joined; reuses the stored token if it has > 14 days left (`RENEW_BEFORE_MS`); otherwise `POST /album/session` (15 s timeout) with `{ code, who }` and, if the old token is still valid, `Authorization: Bearer` for silent renewal. Results: `{ token }` or `{ error: 'not-joined' | 'wrong-code' (401, token cleared) | 'not-set-up' (501) | 'offline' }`; when offline or on other errors a still-valid old token is used.
- **Pipeline** (`pipeline.ts`): decode with `createImageBitmap` (applies EXIF orientation), falling back to `<img>.decode()`; otherwise `UnsupportedImageError` ("share it as JPEG"). Canvas re-encode to **JPEG** (Safari can't encode WebP): full ≤ 2048 px long edge, qualities 0.82 → 0.72 → 0.62, then edges 1600 and 1280, until ≤ 1.5 MB (`MAX_FULL_OUTPUT`); thumbnail 480 px at 0.78. Never upscales.
- **JPEG helpers** (`jpeg.ts`, shared with the Worker): `isJpeg`, `hasExif`, `stripJpegMetadata` (drops APP1–APP15 and COM, keeps APP0/JFIF). Run on both sides.
- **Queue** (`queue.ts`): states `queued | uploading | waiting-offline | failed`; `MAX_PARALLEL_UPLOADS = 2`; backoff `BASE_BACKOFF_MS` 2 s doubling to `MAX_BACKOFF_MS` 5 min, ±25 % jitter. **No maximum number of attempts** and no per-item timeout other than the XHR's. Resumes after reloads (`uploading` → `queued`), on `online`, and on returning to the tab. Events `uploaded`, `failed`, `undone-late`.
- **Repository** (`repository.ts`): `list()` (20 s timeout), `imageUrl`, `upload` via **XMLHttpRequest** (multipart `meta`/`full`/`thumb`, `upload.onprogress`, 120 s timeout), `caption` (PATCH) and `setCover` (PUT) with `If-Match: "<version>"` (409 → `conflict` with the server's current value), `remove` (DELETE). Upload outcomes: 200/201 → `done`; **400, 409, 413, 415 → `failed`** (with a reason); everything else (401, 429, 5xx, network error, timeout, unparsable body) → `retry`.
- **Service** (`service.ts`): a module singleton holding the listing, queue view and local previews (object URLs). The queue's `upload` asks for a token first; **any token error maps to `{ kind: 'retry', status: 401 }`**. Sets `album:pending` while anything not failed is queued; warns on `beforeunload`. `addPhotos` processes files and shows an "Added" toast with **Undo** (6 s); undo cancels queued items or deletes landed ones. Also `deletePhoto`, `retryUpload`, `editCaption`, `makeCover` (conflicts show "Someone just updated this").
- **`useAlbum`**: subscribes, starts the queue, refreshes on mount and every 60 s while visible.
- **`AlbumQueueHost`** (always in the shell): if `album:pending` is set, lazy-imports the service and resumes uploads; otherwise no album code loads.
- `selectors.ts` (`photosByFrame`, `coverFor`, `albumProgress`, `suggestFrame` with dinner from 17:00 Tbilisi, `storySlides`), `zip.ts` (stored ZIP writer) and `download.ts` ("Download all" in story order).

## 6. Visual system

**Design tokens** (`src/styles/tokens.css`). Components use the variables only.

- **Colors:**
  - Base: `--color-bg`, `-bg-sky`, `-surface`, `-surface-muted`, `-border`, `-ink`, `-ink-muted`.
  - Primary `#1059a8`: `--color-primary`, `-primary-ink`, `-primary-soft`.
  - Accent "Saperavi wine" `#9b1b40`: `--color-accent`, `-accent-soft`.
  - Other: `--color-sun`, `--color-focus` `#ff9f1c`, `--shadow-card`.
  - Map: `--map-*` and `--run-novice|easy|intermediate|advanced|unknown`.
  - Atmosphere: `--backdrop-veil`, `--snowflake`, `--snowflake-glow`.
- **Typography:** `--font-display` Fredoka (self-hosted via `@font-face`), `--font-body` system UI; `--text-sm|md|lg|xl|2xl|countdown` (the last two use clamp()).
- **Spacing and shape:** `--space-1…7` (0.25–3 rem), `--radius-sm|md|lg|pill`.
- **Layout:** `--content-max` 46 rem, `--header-height` 3.5 rem, `--tab-bar-height` 4 rem, `--gutter`. `--breakpoint-desktop` is documentation only; media queries repeat `56rem`.
- **Dark mode:** one `@media (prefers-color-scheme: dark)` block redefines the color tokens. There's **no manual theme toggle**.
- **Motion:** `prefers-reduced-motion` disables the snowfall and transitions/animations globally.
- **Where the CSS lives:** all component CSS is in `src/styles/global.css` (about 3,190 lines, BEM-ish class names, sections marked with comments). There are no CSS modules.

**Avatars**

- `src/avatars/FaceArt.tsx`: one parametric SVG face (120×120): hair styles short/long/bun/wavy, eyes, lashes, freckles, glasses, optional shoulders/jacket and goggles.
- Traits from `CHARACTERS` in `src/data/characters.ts`; tests keep hair readable against skin and the four hair colours distinct.
- `src/avatars/Avatar.tsx`: `AvatarFace` (round portrait) and `AvatarSkier` (full body, viewBox 120×150), labelled with `role="img"` unless `decorative`.
- Used on Home ("The crew"), the profile switchers, the game picker and the game sprite (`game/sprites.ts` rasterizes `AvatarSkier`). Each traveler's jacket color doubles as their UI accent (`--member-color`).

**Ski map**

- **Source:** OpenStreetMap through Overpass. `scripts/fetch-pistes.ts` (`npm run fetch:pistes`) writes `src/data/pistes.json` (about 3.9 kB gzipped). ODbL; attribution in the footer, the map page, `#/credits` and the README.
- **Coordinates:** equirectangular projection; bounding box S 42.445, W 44.44, N 42.56, E 44.525; map units 1000 × 1835, north up, about 7 m per unit; Douglas–Peucker tolerance 1.2 (`scripts/lib/geometry.ts`).
- **Data** (`src/lib/map/types.ts`, `PisteMap`): 50 runs, 16 lifts, 8 POIs; only the 6 named peaks have `eleM`. No DEM.
- **Renderer** (`src/components/map/PisteMapSvg.tsx`): original stylized SVG (snow, ridges, pines, runs with hit paths, lifts, labels, POIs); every run group and lift is a `<g data-key>`; props `selectedKey`, `viewBox`, `labels`.
- **Uses:** `MapBackground` (cropped, blurred backdrop on every page) and `MapPage` (zoom, tap-to-select, lists, attribution).
- The altitude illustration on `#/weather` is a separate component (`components/weather/MountainZones.tsx`, 3 bands), as recommended at `v1.0.0`.

**Shared UI** (no modal, dialog or tabs components by design)

| UI            | Where                                                                                                                                                 | Notes                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Card          | `.card` class in global.css                                                                                                                           |                                                                                                              |
| Buttons       | `.button`, `.button--primary`, `.button--danger`, `.icon-button`, `.icon-button--danger`, `.chip-button[aria-pressed]`, `.link-button`, `.button-row` | No Button component; plain markup + classes                                                                  |
| Switch        | `.switch[role=switch]`                                                                                                                                | Inline markup                                                                                                |
| Toast         | `lib/toast/toastStore.ts` + `components/ToastHost.tsx`                                                                                                | `toasts.show({ title?, message, emoji?, action?, durationMs })`; `durationMs: null` is sticky; max 2 visible |
| Confirmation  | Inline `.confirm` blocks (BackupPanel, album "Delete for everyone?")                                                                                  | Native `alert/confirm` are banned (CLAUDE.md)                                                                |
| Page header   | `components/PageHeader.tsx`                                                                                                                           | h1 + back link (`back` prop) + focus management                                                              |
| List toolkit  | `components/common/` (ProfileSwitcher, ProgressSummary, BackupPanel, TemplateOffer, SyncPanel, JoinGroupForm, ChangedBy)                              | Shared by packing and to-dos; `JoinGroupForm` also by the album                                              |
| Loading/error | `lazyPage` ("Loading…", alert + retry); `.page-loading`; `.empty-state`, `.empty-note`                                                                |                                                                                                              |
| Notes         | `.note`, `.note--warning`                                                                                                                             |                                                                                                              |
| Icons         | `components/Icon.tsx`                                                                                                                                 | 31 stroke icons (incl. calendar, cloudSnow, video, food, credits, camera, music, play, pause, skip)          |
| Carousel      | `lib/facts/carousel.ts`, `components/album/useCarousel.ts`                                                                                            | Swipe and arrow keys (facts, album viewer and story)                                                         |
| Overlay panel | Game-specific `.game__overlay` / `.game__panel`                                                                                                       | Closest thing to a modal                                                                                     |

**Album UI**

- `AlbumPage` (`#/album`): "The story so far" progress (captured / 19 planned, plus bonus), "Story mode" link, **Download all** (ZIP, with an estimated size), the frame grid of `FrameCard`s (cover or empty frame with prompt and emoji, count, pending label like "Uploading 2…", add buttons), and `AlbumJoin` when this phone hasn't joined.
- `AlbumFramePage` (`#/album/<frame>[/<photo>]`): swipeable viewer (the URL follows the current photo via `history.replaceState`), "Uploading N%" / failed-with-Retry status for queued photos, caption edit, make cover, inline "Delete for everyone?".
- `AlbumStoryPage` (`#/album/story`): a slideshow of title cards and photos in story order.
- `AddPhotoButtons`: "Take photo" (rear camera) and "From gallery" (multiple); picking is the whole flow.
- `QuickAdd` (Home, lazy, only `during` the trip): suggests a frame (`suggestFrame`).
- Images load from the Worker's public image route.

## 7. Backend / serverless proxy

**Provider and location**

- Cloudflare Worker in `/worker` (separate npm package), deployed by CI (`worker-deploy.yml`; the `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets are set). `npx wrangler deploy` still works manually.
- AI: **Cloudflare Workers AI**, model `@cf/meta/llama-3.1-8b-instruct-fp8` (`MODEL` var), through the **`AI` binding**, so no API key.
- The Worker bundles `src/data/**` and parts of `src/lib/**` (see §10 for the deploy-filter gap). Shared code must stay pure (no storage or Preact imports).

**Router** (`worker/src/router.ts`)

- Route table with a shared pipeline: path match → (public routes skip the rest) → origin allowlist (403) → `OPTIONS` preflight (204) → method (405 with `Allow` listing every method for that path) → per-IP rate limit (429, `Retry-After: 60`, keyed on `CF-Connecting-IP`) → handler.
- Paths may contain `:name` segments (URI-decoded; bad encoding → 400); several routes can share a path with different methods.
- `cors.ts`: `Access-Control-Allow-Origin` = the allowed origin, `Allow-Methods` = the path's methods + `OPTIONS`, **`Allow-Headers: Content-Type, Authorization, If-Match`**, `Max-Age` 86400, `Vary: Origin`.
- Unknown path → 404.

**Routes** (registered in `worker/src/index.ts`)

| Method | Path                           | Auth / limiter                       | Notes                                                                                                                                                                                                                                                                                           |
| ------ | ------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                      | public                               | `{ ok: true }`                                                                                                                                                                                                                                                                                  |
| POST   | `/chat`                        | `RATE_LIMITER`                       | `{ messages }` → `{ reply }`; system prompt + live context. 400, 413, 502 model error, 503 quota                                                                                                                                                                                                |
| GET    | `/rates`                       | `RL_DATA`                            | NBG, fallback open.er-api.com; KV `rates:v1` TTL 12 h, stale 7 d; `max-age=600`; 503                                                                                                                                                                                                            |
| GET    | `/itinerary`                   | `RL_DATA`                            | Secret `CALENDAR_ICS_URL` (501 until set); KV `itinerary:v1` TTL 20 min, stale 7 d; `max-age=60`; 503                                                                                                                                                                                           |
| GET    | `/weather`                     | `RL_DATA`                            | Open-Meteo; KV `weather:v1` TTL 30 min, stale 24 h; `max-age=300`; 503                                                                                                                                                                                                                          |
| POST   | `/sync`                        | `RL_DATA`; Bearer group code         | Constant-time compare with `GROUP_CODE`; 501 until set (and `LISTS` bound); `no-store`                                                                                                                                                                                                          |
| POST   | `/album/session`               | `RL_AUTH`                            | 501 unless `ALBUM`, `GROUP_CODE` and `ALBUM_SIGNING_KEY` are all set. A valid Bearer token renews silently; otherwise body `{ code, who }` (400 if malformed, 401 "Wrong group code"). 200 `{ token, expiresAt }`, `no-store`                                                                   |
| GET    | `/album`                       | `RL_DATA` (origin-checked, no token) | 501 if `ALBUM` unbound; 200 `AlbumListing`, `no-store`                                                                                                                                                                                                                                          |
| POST   | `/album/:frameId/photos`       | `RL_DATA`; token                     | 400 unknown frame / bad form / bad meta / missing image; 413 over `MAX_UPLOAD_BYTES` (Content-Length) or per-file limits; 415 not JPEG; existing id → 200 (idempotent retry); stores re-stripped images in `frame:<id>`, then the index; 409 "This frame is full" (images removed); 201 created |
| PATCH  | `/album/photos/:photoId`       | `RL_DATA`; token                     | `{ caption }` (cleaned); optional `If-Match` (400 if malformed); 404; 409 `{ error, current }`; 200 with `ETag`                                                                                                                                                                                 |
| DELETE | `/album/photos/:photoId`       | `RL_DATA`; token                     | Removes metadata, then the frame's images; always 204                                                                                                                                                                                                                                           |
| PUT    | `/album/:frameId/cover`        | `RL_DATA`; token                     | `{ photoId }`; optional `If-Match`; 400 unknown frame / bad id; 404 photo not in frame; 409 `{ error, current }`; 200 with `ETag`                                                                                                                                                               |
| GET    | `/album/photos/:photoId/image` | **public** (no origin check)         | `?size=full`, else thumb; 501 if `ALBUM` unbound; 404; `image/jpeg`, `Cache-Control: public, max-age=31536000, immutable`, `ETag`, `X-Robots-Tag: noindex`, `X-Content-Type-Options: nosniff`, `Access-Control-Allow-Origin: *` (for "Download all")                                            |

Album changes without a token, or with an invalid/expired one, get 401 "Join the group to change the album"; with the album not set up, 501.

**Album storage** (`worker/src/album/`)

- `AlbumStore.ts`: a SQLite-backed Durable Object class used as two kinds of instance:
  - **`index`** (`idFromName('index')`): tables `photos` (id, frame_id, uploaded_by, uploaded_at, caption, width, height, thumb_w, thumb_h, version) and `frames` (frame_id, cover_photo_id, version). Add, caption, cover and remove run in `transactionSync`.
  - **`frame:<id>`**: table `images (photo_id, size, bytes BLOB)`; `putImages` writes full + thumb in one transaction. One object per frame keeps each small (Free plan: 2 MB per row).
- `logic.ts`: rules over an `IndexDb`/`ImageDb` interface (memory implementations for tests). `addPhoto` returns `exists` for a known id and `full` at 30 photos per frame (count checked inside the transaction); `setCaption`/`setCover` bump versions and check `ifMatch` when given; `removePhoto` resets the frame's cover (bumping its version) if it pointed at the deleted photo. Listing is sorted by `uploadedAt`, then id.
- `token.ts`: `base64url(JSON { v: 1, who, exp })` + `.` + `base64url(HMAC-SHA256)` with `ALBUM_SIGNING_KEY`; verify via `crypto.subtle.verify` (constant time), checks `v`, a known traveler and `exp`. Expiry = max(2027-03-15T23:59:59Z, now + 30 days). Rotating the key logs everyone out.

**Shared lists storage** (`worker/src/sync/`): `ListsStore` Durable Object (SQLite) applies each sync in `transactionSync`; `recordStore.applySync` keeps a group-wide revision, last arrival wins per record, tombstones, 3,000 records per doc.

**Config names** (names only; `worker/wrangler.toml`, `worker/src/env.ts`)

| Kind           | Name                 | Purpose                                                                                                                   |
| -------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Binding        | `AI`                 | Workers AI                                                                                                                |
| Rate limiter   | `RATE_LIMITER`       | `/chat`: 10 per 60 s per IP (namespace 1001)                                                                              |
| Rate limiter   | `RL_DATA`            | Data, sync and album routes: 60 per 60 s per IP (namespace 1002)                                                          |
| Rate limiter   | `RL_AUTH`            | `/album/session`: 5 per 60 s per IP (namespace 1003)                                                                      |
| KV             | `CACHE`              | Upstream cache for `getOrRefresh` (rates, weather, itinerary)                                                             |
| Durable Object | `LISTS`              | `ListsStore` (migration `v1`, `new_sqlite_classes`)                                                                       |
| Durable Object | `ALBUM`              | `AlbumStore` (migration `v2`, `new_sqlite_classes`)                                                                       |
| Var            | `ALLOWED_ORIGINS`    | `https://ofekfa.github.io,http://localhost:5173,http://localhost:4173`                                                    |
| Var            | `MODEL`              | AI model id                                                                                                               |
| Secret         | `CALENDAR_ICS_URL`   | Google Calendar secret iCal address (set)                                                                                 |
| Secret         | `GROUP_CODE`         | Unlocks shared lists and album changes (set)                                                                              |
| Secret         | `ALBUM_SIGNING_KEY`  | HMAC key for album tokens (**not set in production yet**)                                                                 |
| Build var      | `VITE_ASSISTANT_URL` | GitHub repo **variable** (not a secret), read in `deploy.yml`; local dev uses `.env.local` (documented in `.env.example`) |

**Limits** (`worker/src/limits.ts`)

- Chat: `MAX_MESSAGE_CHARS` 500, `MAX_MESSAGES` 10, `MAX_BODY_BYTES` 16,000, `MAX_OUTPUT_TOKENS` 320, `TEMPERATURE` 0.4.
- Upstream: `UPSTREAM_TIMEOUT_MS` 8 s; `MAX_ICS_BYTES` 3 MB; cache TTLs and browser `max-age` values as in the route table.
- Live context: `LIVE_CONTEXT_MAX_CHARS` 1,500, `LIVE_SOURCE_TIMEOUT_MS` 1.5 s, `LIVE_TEXT_MAX_CHARS` 60; dish list `DISH_LIST_MAX_CHARS` 2,500.
- **Rate limits are approximate:** the free binding is eventually consistent across locations; a burst once got through about 75 requests before 429s.

**System prompt** (`worker/src/prompt.ts`, `buildSystemPrompt(now, live)`)

- Bundles `src/data/trip.ts`, `src/data/facts.ts` (incl. words) and a compact dish list (`dishList.ts`); formats both flight legs in airport time zones.
- `liveContext.ts` adds today's/tomorrow's plan, weather per zone and rates (from the same `load*` functions as the data routes), marked as data, not instructions.
- Data changes reach the assistant when the Worker redeploys, which CI does for the filtered paths.

## 8. Security & external resources

- **Content Security Policy: none.** No CSP `<meta>` in `index.html`; GitHub Pages can't set headers. The decision is recorded in `PLAN.md`. A future meta CSP would need `connect-src` for the Worker, `img-src` for the Worker's album images, `frame-src` for youtube-nocookie, `media-src` for Commons and archive.org audio.
- **Runtime requests from the site:**
  - **Worker** (`WORKER_URL`): `/chat`, `/rates`, `/itinerary`, `/weather`, `/sync`, `/album*` (fetch/XHR and `<img>`).
  - **Audio:** MP3s streamed from Wikimedia Commons and archive.org, only after the first user gesture.
  - **Iframes:** `youtube-nocookie.com` (webcams and music embeds), tap-to-load only; outbound links to youtube.com.
  - No third-party scripts, stylesheets, fonts or analytics. The font is self-hosted.
  - **Web Speech API:** browser built-in; in Chrome, recognition audio goes to the browser vendor's service.
- **Upstream APIs (from the Worker):** Workers AI (binding), NBG and open.er-api.com (rates), Open-Meteo (weather), Google Calendar ICS (secret URL).
- **Build-time:** Overpass (`fetch:pistes`), NBG (`fetch:rates`, every Pages deploy), Wikimedia Commons (`fetch:dish-images`), track URLs (`analyze:tracks`).
- **Auth:**
  - Shared lists: Bearer group code compared in constant time with `GROUP_CODE`.
  - Album: group code → HMAC token (`RL_AUTH` 5/min on attempts); viewing is public by design (anyone with the site can see the photos; image responses say `noindex`).
  - Album privacy: EXIF/GPS removed by canvas re-encoding and `stripJpegMetadata` on the phone **and** the Worker; JPEG only.
- **Privacy rule** (CLAUDE.md): first names and public flight info only. The site and the album are public.

## 9. Quality & workflow

**Commands**

- Site: `npm run dev`, `lint` (ESLint + `prettier --check`), `format`, `typecheck` (app, `scripts/` and `src/sw` tsconfigs), `test`, `build` (typecheck + Vite), `preview`, `fetch:pistes`, `fetch:rates`, `fetch:dish-images`, `analyze:tracks`, `og-image`.
- Worker: `npm test`, `npm run typecheck`, `npx wrangler dev|deploy|tail`.

**Tests: 404 site (52 files) + 75 Worker (10 files)** as of `v1.12.0`, all pure or unit-level in Node. There are no component, DOM or committed E2E tests; local end-to-end checks (puppeteer, `wrangler dev`) are run by hand and not in the repo.

| Area                                                                  | Covers                                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/time`, `lib/router`, `navigation`                                | Trip phases and day boundaries in Tbilisi; formatting in zones; hash parsing, `matchRoute`/`basePath`; 5 tab-bar items               |
| `lib/storage`, `lib/list`                                             | Prefixing, throwing/missing storage; versioned load/save/migrations; list helpers                                                    |
| `lib/packing`, `lib/todo`                                             | Reducers, selectors, import/export validation, repositories, due dates                                                               |
| `lib/sync`                                                            | Records, adapters, client merge without losing in-flight edits                                                                       |
| `lib/album` (4 files)                                                 | Protocol validation, JPEG stripping, tokens, queue/backoff/undo, selectors, ZIP                                                      |
| `lib/facts`, `lib/speech`, `lib/music`, `lib/toast`                   | Shuffle bag and gate, carousel; voices and recognition; music machine, shuffle bag, settings; toast queue                            |
| `lib/currency`, `lib/weather`, `lib/itinerary`, `lib/food`, `lib/map` | Parsers and validators, conversion and rounding, plan building, dish search/filter, run grouping                                     |
| `data/*.test.ts` (9 files)                                            | Characters, facts, words, templates, dishes and images (≤ 60 kB), tracks and licences, embeds, album frames                          |
| `sw/routing.test.ts`, `game/*`, `assistant/`                          | Request classification and cache names; game engine and high scores; assistant client                                                |
| `worker/test/` (10 files)                                             | Router (params, methods, 405, CORS), chat, cache, rates, weather (captured fixture), itinerary, live context, dish list, sync, album |

**CI** (`.github/workflows/`)

- `ci.yml` on PRs: **`check`** (`npm ci`, lint, typecheck, test, test with `TZ=America/Los_Angeles`, build) and **`worker`** (`npm ci`, typecheck, test in `worker/`).
- `deploy.yml` on push to `main` and manual dispatch: `npm ci`, lint, test, `fetch:rates`, build (with `VITE_ASSISTANT_URL`), then the Pages actions.
- `worker-deploy.yml` on push to `main` touching `worker/**`, `src/data/**`, `src/lib/facts/types.ts`, `src/lib/{weather,itinerary,currency}/**` or the workflow itself (and manual dispatch): typecheck, test, then `cloudflare/wrangler-action@v4`. Skips the deploy with a warning when the secrets are missing (they're set).

**Conventions actually followed**

- `main` + short-lived branches (merged PRs: 50 `feat/`, 25 `docs/`, 10 `fix/`, 3 `refactor/`, 1 each `chore/`, `ci/`, `perf/`).
- Conventional Commits with `Co-Authored-By: Claude …` trailers; one PR per slice with a description + checklist; green CI, then `gh pr merge --squash --delete-branch`.
- After each phase: a docs PR updating `PLAN.md` and this report, then an annotated tag.
- No `CONTRIBUTING.md`.

**Bundle** (local production build at `v1.12.0`; gzip sizes)

- Main chunk: `index` JS 15.6 kB + shared Preact/JSX runtime 6.2 kB + CSS 10.6 kB. `sw.js` 1.6 kB.
- Largest lazy chunks: dishes data 9.3 kB, GamePage 7.0 kB, facts data 6.5 kB, album service 6.5 kB, packing state 5.7 kB, TodoPage 4.8 kB, WeatherPage 4.5 kB, tracks 4.3 kB, pistes 3.9 kB, AssistantPage 3.3 kB, AlbumPage 2.6 kB, AlbumFramePage 2.1 kB.
- Font: 29 kB woff2, preloaded.
- Album routes, measured live on 2026-10-22 after `v1.12.0`:
  - Lighthouse mobile: `#/album` performance 96 / accessibility 100; `#/album/snowman` 100 / 100; CLS 0 on both.
  - The live audit (axe in light and dark, overflow at 375 px, one `<h1>`, console errors) was clean on `#/album`, `#/album/snowman` and `#/album/story`, with the album empty.
  - With photos, the views were checked only in local end-to-end runs.

## 10. Known issues & recommendations

**Bugs, risks and fragile areas**

1. **Album uploads never complete while `ALBUM_SIGNING_KEY` is unset (open bug).** `POST /album/session` returns 501, `getAlbumToken` returns `not-set-up`, and `service.ts` maps any token error to a `retry` outcome. The queue has no attempt limit, so it retries forever with backoff (up to 5 min), and the UI shows "Uploading…"/0 % with no error. Setting the secret unblocks uploads; the missing error state is still a bug (also true for `not-joined` and `wrong-code`). Details in `docs/HANDOFF.md`.
2. **Worker deploy path-filter gap.** `worker-deploy.yml` doesn't include `src/lib/album/**` or `src/lib/sync/**`, yet the Worker bundles `src/lib/album/protocol.ts`, `src/lib/album/jpeg.ts` and `src/lib/sync/protocol.ts` (also `src/lib/time/countdown.ts`, and the type-only `src/lib/food/types.ts`). A change to only those files merges without redeploying the Worker, so the site and the Worker can disagree on the wire format or limits. Add the paths (or `src/lib/**`).
3. **Album not tested on real phones:** iOS Safari camera capture and HEIC decoding, Android Chrome, background/resume behaviour. Only emulated devices and a local Worker were used.
4. **Album `uploadedBy` is taken from the upload meta**, not the token's `who`; any group member can attribute a photo to someone else. Low risk among four friends.
5. **Rate limiter is approximate** (~75-request bursts got through). The free AI allowance is the hard cap.
6. **No CSP.** Decided deliberately (see `PLAN.md`); revisit if third-party content grows.
7. **Unused or duplicated code:**
   - `ComingSoonPage` and the `comingSoon` flag are unused.
   - `--breakpoint-desktop` is unused in media queries.
   - `MAX_FIELD_WIDTH` (game, 480 px) is duplicated as `30rem` in CSS.
   - `album:pending` is defined in both `service.ts` and `AlbumQueueHost.tsx` (on purpose, to keep the shell small).
8. **Tests:** no component, DOM or E2E tests in the repo; UI checks are manual or ad-hoc scripts.
9. **Packing filter state is per page visit:** not persisted, by design.

**What happened to the `v1.0.0` recommendations**

| Recommendation (v1.0.0)                         | Status                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Worker route table + CI deploy                  | Done in 8.0; deploy secrets set; path filters need extending (item 2)           |
| Desktop nav overflow, grouped More page         | Done in 8.0 (header shows the 5 tab-bar items; More grouped Plan / Tools / Fun) |
| Generic list toolkit + storage migration helper | Done in 8.0 (`lib/list`, `components/common`, `versioned.ts`)                   |
| Fact discriminated union, Georgian words        | Done in 8.0/8.1                                                                 |
| Currency, to-do, itinerary, weather + webcams   | Done in 8.2–8.5                                                                 |
| Align TypeScript versions, drop `jsdom`         | Done in 8.0 (both 6.0.3; `jsdom` removed)                                       |
| Shared items need a backend                     | Done in 10.1 (`/sync`, `ListsStore`)                                            |

**Next steps**

1. Set `ALBUM_SIGNING_KEY` (`npx wrangler secret put ALBUM_SIGNING_KEY` in `worker/`), then check a live upload end to end.
2. Show a clear error for album token failures (`not-set-up`, `wrong-code`, `not-joined`) instead of retrying silently, and consider an attempt cap.
3. Extend `worker-deploy.yml` path filters.
4. Test the album on real iPhones and Android phones.
