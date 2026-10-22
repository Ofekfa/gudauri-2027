# Gudauri 2027 — Codebase Report

_Generated 2026-10-22 from the code at `main` @ `b7cb618` (tag `v1.0.0`); **updated after Phase 10.2 (`v1.11.1`)**, see the changelog below. Every statement was checked against the files. Items marked **(unverified)** are informed estimates that need checking._

## Changelog since v1.0.0

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
- Without the secrets it tests and skips the deploy with a warning. **The secrets are pending Ofek's manual step**; until then, deploys are still manual.

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

## 1. Overview

**Repo, URL and state**

- Repo: `github.com/Ofekfa/gudauri-2027` (public). Default branch `main`.
- 29 squash-merged PRs. Tags: `v0.1.0`, `v0.1.1`, `v0.2.0`–`v0.6.0`, `v1.0.0`. GitHub Release `v1.0.0`.
- Live site: https://ofekfa.github.io/gudauri-2027/
- AI proxy (Cloudflare Worker): `https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev`
- `PLAN.md`: all 7 phases ✅.
  - Open item: hands-on testing on real phones (iOS Safari speech input/read-aloud, Android Chrome, game touch steering).
  - Several sentences in `PLAN.md` are now **stale**; see §10.

**Stack and versions** (from `package.json` / `worker/package.json`)

| Area        | Choice                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework   | **Preact 11** (`preact ^11.0.1`), the **only runtime dependency** (UI rendering + hooks)                                                                |
| Language    | TypeScript **6.0** (site); **TypeScript 7.0** in `worker/` (version mismatch, see §10)                                                                  |
| Build       | Vite 8 + `@preact/preset-vite`                                                                                                                          |
| Tests       | Vitest 5 (`environment: 'node'`); `jsdom` is installed but **unused**                                                                                   |
| Lint/format | ESLint **9** (pinned: `eslint-plugin-jsx-a11y` doesn't support 10), `typescript-eslint`, `eslint-plugin-jsx-a11y`, `eslint-config-prettier`, Prettier 3 |
| Node        | `engines: >=22`; CI uses Node 22; local dev used Node 24 (runs the `.ts` script natively)                                                               |
| Worker      | Wrangler 4.151, `@cloudflare/workers-types`, Vitest                                                                                                     |

There's no router library, state library, CSS framework, date library or icon library: everything is in-house.

**Deviations from the original brief** (also listed in `PLAN.md` → "Deviations")

- **Navigation:**
  - The router is in-house (hash-based).
  - "More" is a page (`#/more`), not a pop-up sheet.
- **Map data:** comes from **Overpass/OSM**, not OpenSkiMap downloads (the worldwide files are too large). OpenSkiMap is credited and linked.
- **Packing:**
  - Lists are **per-device** (localStorage), by Ofek's choice; there's no sync.
  - The starter template defaults every item to "Already have".
- **Fun facts:**
  - 55 facts, beating the 40+ target.
  - The Facts page shows **one fact at a time** (swipe / ← → / buttons), per feedback.
  - Pop-ups are paused on `/game` and `/facts`.
- **Game:** flags are obstacles, not slalom gates.
- **Assistant:**
  - The proxy uses **Cloudflare Workers AI** with no API key.
  - The planned per-IP **daily cap was dropped**: the free rate limiter only supports 10 s/60 s windows and is approximate.
  - The Groq fallback was documented in planning but **not implemented**.
- **Avatars:** changed after feedback (Maya: brown eyes + glasses; Roy: undercut; Ofek: warmer skin). Phase 10.2 (`v1.11.1`): Ron's hair brown, Ofek's light/ash brown; tests keep hair readable against skin and all four hair colours apart; `og-image.png` comes from `scripts/og-image.mjs`.
- **Phase 7:** the font is now self-hosted (Fredoka, OFL), replacing Google Fonts, for performance.

## 2. Structure

```
.
├─ .github/workflows/        ci.yml (PR checks), deploy.yml (Pages on push to main)
├─ docs/                     (will contain this report; uncommitted)
├─ public/                   copied verbatim to dist/
│  ├─ 404.html               GitHub Pages fallback → redirects to /gudauri-2027/
│  ├─ favicon.svg, apple-touch-icon.png, og-image.png (1200×630 link preview)
│  └─ fonts/                 fredoka-latin.woff2 (variable 500–700) + Fredoka-OFL.txt
├─ scripts/                  one-off Node scripts (own tsconfig)
│  ├─ fetch-pistes.ts        Overpass → projected/simplified src/data/pistes.json
│  └─ lib/geometry.ts(+test) haversine, projection, Douglas–Peucker, SVG path
├─ src/
│  ├─ main.tsx               bootstrap: imports tokens.css + global.css, renders <App/>
│  ├─ app.tsx                shell + PAGES route map + global widgets
│  ├─ navigation.ts(+test)   route metadata (titles, icons, tab-bar placement)
│  ├─ vite-env.d.ts          typed import.meta.env (VITE_ASSISTANT_URL)
│  ├─ assistant/             client.ts(+test): fetch to Worker, error mapping
│  ├─ avatars/               FaceArt.tsx (shared SVG face), Avatar.tsx (AvatarFace, AvatarSkier)
│  ├─ components/            shared UI (Header, BottomTabBar, PageHeader, Icon, ToastHost, Countdown, FlightCard, Crew, SectionCards, Snowfall, Footer)
│  │  ├─ facts/              FactPopups.tsx (invisible scheduler → toasts)
│  │  ├─ map/                PisteMapSvg.tsx (renderer), MapBackground.tsx (blurred backdrop)
│  │  └─ packing/            AddItemForm, PackingItemRow, FilterBar, ProfileSwitcher, TemplateOffer, BackupPanel
│  ├─ data/                  content/config: trip.ts, characters.ts, facts.ts, packingTemplate.ts, pistes.json (+tests)
│  ├─ game/                  canvas game: constants, engine (pure), render, sprites, input, controller, highScores (+tests)
│  ├─ lib/                   pure logic, framework-light, unit-tested
│  │  ├─ facts/              types, rotation (shuffle bag + gate), settings (mute), carousel (swipe/keys)
│  │  ├─ map/                types (PisteMap), catalog (difficulty labels, run grouping)
│  │  ├─ packing/            model, reducer, selectors, importExport, repository, usePacking
│  │  ├─ router/             hashRouter, lazyPage
│  │  ├─ speech/             recognition (SpeechRecognition wrapper), synthesis (TTS)
│  │  ├─ storage/            safeStorage (never-throwing localStorage + memory fallback)
│  │  ├─ time/               countdown (trip phase), format (formatInZone…), useNow
│  │  └─ toast/              toastStore (framework-free queue)
│  ├─ pages/                 one component per route (Home, Flights, Packing, Facts, Map, Game, Assistant, More, NotFound, ComingSoon)
│  └─ styles/                tokens.css (design tokens + @font-face + dark mode), global.css (all component CSS, ~1,835 lines)
├─ worker/                   Cloudflare Worker (separate npm package)
│  ├─ src/index.ts           request handler (/chat, /health), CORS, rate limit, validation
│  ├─ src/prompt.ts          builds the system prompt from ../../src/data/{trip,facts}.ts
│  ├─ src/limits.ts          size and length limits
│  ├─ test/index.test.ts     11 tests
│  ├─ wrangler.toml          bindings + vars
│  └─ README.md              setup/deploy guide
├─ index.html                Vite entry: meta/OG tags, font preload, #app
├─ vite.config.ts            base '/gudauri-2027/', preact plugin
├─ vitest.config.ts          includes src/**/*.test.ts(x), scripts/**/*.test.ts
├─ eslint.config.js, .prettierrc, .prettierignore, tsconfig.json
└─ CLAUDE.md, README.md, PLAN.md, LICENSE (MIT), .env.example
```

**Bootstrap flow**

1. `index.html` loads `/src/main.tsx`.
2. `main.tsx` imports the CSS and calls `render(<App/>)` into `#app`.
3. `App` reads the hash path through `useHashPath()` and sets `document.title`.
4. `App` renders the global layers, in this order:
   - skip-link button
   - `MapBackground` (lazily imports `pistes.json`)
   - `Snowfall`
   - `Header`
   - `<main key={path}>` with the page
   - `Footer`
   - `ToastHost`
   - `FactPopups` (lazily imports `facts.ts`)
   - `BottomTabBar`

## 3. Routing & navigation

**How routing works**

- It's hash-based: `#/flights`. GitHub Pages never sees the path, so refresh and deep links work. `public/404.html` redirects unknown real paths to the root.
- `src/lib/router/hashRouter.ts`:
  - `parseHash()` strips the query and any trailing slash. Anything that doesn't start with `/` maps to `/`.
  - `useHashPath()` listens to `hashchange`.
  - `href(path)` builds `#path`.
- Route → component map: `PAGES` in `src/app.tsx`.
  - Heavy pages use `lazyPage(() => import(...))` (`src/lib/router/lazyPage.tsx`), which provides "Loading…" and error-with-retry states.
  - Eager pages: Home, Flights, More.
- Unknown paths: if the path has a nav item flagged `comingSoon`, `ComingSoonPage` renders; otherwise `NotFoundPage`.
  - No item is currently `comingSoon`, so that branch is unused but still wired.
- On `hashchange`, `App` sets `body.dataset.navigated` and scrolls to the top. `PageHeader` then focuses the page `<h1>` for screen readers.

**Steps to add a page**

1. Create `src/pages/XPage.tsx`. Use `export default` if it should be lazy-loaded. Start it with `<PageHeader title=… subtitle=…/>` to get the `<h1>`, the "Back to Home" link and focus handling.
2. Add a `NavItem` to `SECTIONS` in `src/navigation.ts` with `path`, `title` (h1 + document title), `navLabel`, `icon` (must be an `IconName` from `src/components/Icon.tsx`; add a path there if needed), `blurb` and `inTabBar`.
3. Register it in `PAGES` in `src/app.tsx`, e.g. `'/x': lazyPage(() => import('./pages/XPage'))`.
4. If it should never show fact pop-ups, add the path to `BLOCKED_PATHS` in `src/components/facts/FactPopups.tsx`.
5. Update `src/navigation.test.ts` if tab-bar membership changes. It asserts exactly **5** tab-bar items: Home first, More last.

**Nav UI today**

- **Mobile bottom tab bar** (`BottomTabBar.tsx`, shown under 56rem): a fixed **5-column** grid of Home · Itinerary · Packing · Weather · More. It is **full**.
  - Every other section (Flights, To-do, Currency, Map, Assistant, Food, Facts, Game, Credits) appears as a card on `#/more`, grouped Plan / Tools / Fun, and the More tab lights up for them (`activeTabPath`).
  - New pages should go under More, or replace a tab.
- **Desktop header nav** (`Header.tsx`, 56rem and up): shows the same 5 `TAB_BAR_ITEMS`, so it never overflows.
- **Detail routes:** `matchRoute` in `hashRouter.ts` supports one detail segment (`/food/:id`); `App` passes `basePath(path)` to titles, tab highlighting and fact pop-up blocking.
- **Home "Explore" cards** (`SectionCards`) list all `SECTIONS`. They scale fine with more items.

## 4. Data & config

**Trip config: `src/data/trip.ts`**

```ts
export const TBC = 'TBC' as const;
export type TravelerId = 'ofek' | 'ron' | 'roy' | 'maya';
export interface Traveler {
  id: TravelerId;
  name: string;
}
export interface Airport {
  iata: 'TLV' | 'TBS';
  name: string;
  city: string;
  zoneLabel: string;
  timeZone: string;
}
export interface Baggage {
  carryOnKg?: number;
  checkedKg?: number;
  trolleyKg?: number;
}
export interface FlightLeg {
  flightNo: string;
  carrier: string;
  from: Airport;
  to: Airport;
  departure: string;
  arrival: string | typeof TBC;
  baggage?: Baggage;
  meal?: boolean;
}
export interface Trip {
  name: string;
  resort: string;
  country: string;
  hotel: string;
  destinationTimeZone: string;
  firstDay: string;
  lastDay: string;
  travelers: Traveler[];
  outbound: FlightLeg;
  inbound: FlightLeg;
}
```

Current values:

- Name "Gudauri 2027", resort Gudauri, country Georgia, hotel "Marco Polo Hotel, Gudauri".
- `destinationTimeZone`: `Asia/Tbilisi`. Days `2027-02-24`…`2027-02-28`.
- Travelers: Ofek, Ron, Roy, Maya.
- Outbound: El Al **LY5107**, TLV (Ben Gurion, `Asia/Jerusalem`, "Israel time") → TBS (Tbilisi International, `Asia/Tbilisi`, "Georgia time"). Departs `2027-02-24T05:15:00+02:00`, arrives `2027-02-24T09:50:00+04:00`.
- Return: **LY5110**, TBS → TLV. Departs `2027-02-28T23:55:00+04:00`, arrives `2027-03-01T00:35:00+02:00`.
- Baggage (`BAGGAGE_PER_TICKET`, shared by both legs): carry-on 3 kg, checked 23 kg, trolley 8 kg. Meal: no.

Related data files:

- `src/data/characters.ts`: avatar traits per traveler.
- `src/data/packingTemplate.ts`: 37 starter items.
- `src/data/pistes.json`: map data.
- `src/data/facts.ts`: 55 facts.

**Times and timezones** (no library, only `Intl`)

- All instants are ISO strings with offsets, parsed with `Date.parse`. Display always passes an explicit IANA zone. The viewer's own zone is never used.
- `src/lib/time/format.ts`:
  - `formatInZone(iso, tz) → { time 'HH:MM', date 'Wed 24 Feb 2027', offset 'UTC+2' }`. The date is assembled from `formatToParts` so it renders identically in every browser.
  - Also `utcOffsetLabel`, `formatDuration`, `formatDayRange`.
- `src/lib/time/countdown.ts`:
  - `getTripPhase(nowMs, trip)` → `before | during (day X of N, using the Tbilisi calendar date) | after`.
  - Also `splitDuration`, `localDateIn`, `daysBetween`, `tripTotalDays`.
- `src/lib/time/useNow.ts`: re-renders on wall-clock second boundaries.
- Tests run under the host zone **and** `TZ=America/Los_Angeles` in CI.

**Fun facts**

`src/data/facts.ts` exports `FACTS: Fact[]`. The type lives in `src/lib/facts/types.ts`:

```ts
FACT_TOPICS = ['gudauri','resort','georgia','food','skiing','beginner'] as const
interface Fact { id: string; topic: FactTopic; title: string; text: string; source: string /* https URL */ }
TOPIC_LABEL / TOPIC_EMOJI: Record<FactTopic, string>
```

Facts per topic: gudauri 8 · resort 9 · georgia 12 · food 11 · skiing 7 · beginner 8 (total **55**).

`src/data/facts.test.ts` enforces:

- at least 40 facts with unique ids;
- at least 5 per topic, for **every** topic in `FACT_TOPICS`;
- `text` of at most 220 characters, a non-empty `title`, and an `https` `source`.

**Rotation** (`src/lib/facts/rotation.ts`, pure and tested):

- `createShuffleBag`: every fact shows once per cycle, never twice in a row.
- First pop-up after `FIRST_FACT_DELAY_MS` (20 s).
- Then `MIN_FACT_INTERVAL_MS` (45 s) plus up to `FACT_INTERVAL_JITTER_MS` (45 s) of random extra.
- `initialFactDueAt` respects the last shown time across reloads.
- `shouldShowFact` blocks the pop-up when muted, when the tab is hidden, or on a blocked route.

**Scheduler** (`src/components/facts/FactPopups.tsx`):

- Lazily imports `FACTS` and checks every 5 s.
- Shows a toast (`emoji`, `title`, `message`, Mute action) for 12 s.
- Blocked paths: `/game`, `/facts`.

**Mute setting** (`src/lib/facts/settings.ts`):

- `factSettings.isMuted/setMuted/subscribe`; `lastShownAt/recordShown`.
- Storage keys: `facts:muted`, `facts:lastShownAt`.

**Facts page** (`src/pages/FactsPage.tsx`):

- Topic chips with counts.
- One-card viewer: `wrapIndex`, `detectSwipe`, `keyToDirection` from `src/lib/facts/carousel.ts`.
- 🎲 Surprise me, and the pop-up on/off switch.

**Fitting in "Georgian words"**

- Adding a topic `'words'` to `FACT_TOPICS` makes TypeScript **force** you to add `TOPIC_LABEL` and `TOPIC_EMOJI` entries, because they're `Record`s.
- The tests then require at least 5 word entries.
- The current `Fact` has no structured fields. Recommended: make `Fact` a discriminated union, keeping `text` so existing consumers keep working:
  ```ts
  type Fact = BaseFact &
    (
      | { topic: Exclude<FactTopic, 'words'> }
      | {
          topic: 'words';
          word: string /* Georgian script */;
          transliteration: string;
          meaning: string;
          pronunciation?: string;
        }
    );
  ```
  and fill `text` with a readable sentence.
- Consumers that would need small changes:
  - **`FactsPage` card:** render the word, transliteration and meaning.
  - **`FactPopups` toast:** `title` + `message` only, so it can use `text` unchanged.
  - **Worker `prompt.ts`:** includes every `f.text`, so words reach the assistant automatically, but **only after a Worker redeploy**.
- **Georgian script:**
  - The self-hosted Fredoka subset is **Latin only**, so Mkhedruli falls back to system fonts. iOS/Android/macOS/Windows include Georgian fonts **(unverified per device)**.
  - TTS pronunciation would need a `ka-GE` voice, which is rarely available **(unverified)**.
  - `source` is currently required to be an https URL. A dictionary or reference source is needed per word, or the test must be relaxed for this topic.

## 5. State & storage

**Storage interface: `src/lib/storage/safeStorage.ts`**

- `KeyValueStore { get(key): string | null; set(key, value): void; remove(key): void }`.
- `createSafeStore(getBacking)` wraps `localStorage` in try/catch and **falls back to an in-memory Map**, so it never throws. `createMemoryStore()` is used in tests.
- Singleton `appStore`. Every key gets the prefix **`gudauri2027:`** automatically.
- Keys in use:

| Key                                  | Owner                             | Value                           |
| ------------------------------------ | --------------------------------- | ------------------------------- |
| `packing`                            | `lib/packing/repository.ts`       | `PackingState` JSON             |
| `packing:profile`                    | `PackingPage`                     | last selected traveler          |
| `facts:muted` / `facts:lastShownAt`  | `lib/facts/settings.ts`           | `'true'/'false'` / epoch ms     |
| `game:highScores` / `game:character` | `game/highScores.ts` / `GamePage` | top-5 per character / last pick |
| `assistant:speak`                    | `AssistantPage`                   | `'true'/'false'`                |

- **Versioning and migration:**
  - Only the packing state has a version (`STATE_VERSION = 1`).
  - `validateState()` rejects other versions, which **resets to empty**. There's no migration code.
  - The other keys are unversioned primitives, parsed defensively.
  - There's **no general migration framework**.
- **Sync:** none. All state is per device. Packing export/import (JSON) is the only way to move data.

**Packing model** (`src/lib/packing/`)

- `model.ts`:
  - `CATEGORIES` = clothing | essentials | electronics | ski, plus label and emoji maps.
  - `Ownership` = need-to-buy | have.
  - `PackingItem { id, name, category, ownership, packed, createdAt }`.
  - `PackingState { version: 1, lists: Record<TravelerId, PackingItem[]>, templateDecided: Record<TravelerId, boolean> }`.
  - Limits: 80-character names, 300 items. Helpers: `normalizeName`, `createEmptyState`, `defaultIdGenerator` (uses `crypto.randomUUID`).
- `reducer.ts`: a pure `packingReducer` with actions add / rename / setCategory / toggleOwnership / togglePacked / remove / restore (undo at the original index) / applyTemplate / skipTemplate / replaceAll.
- `selectors.ts`: `filterItems`, `progress` (packed, total, needToBuy) and `groupByCategory`. Status filters: all / to-pack / packed / need-to-buy / have.
- `importExport.ts`:
  - Tagged export `{ app: 'gudauri-2027/packing', exportedAt, data }`.
  - `parseImport` and `validateState` treat input as untrusted: they skip invalid or duplicate items and drop unknown travelers.
- `repository.ts`: async `PackingRepository { load(); save() }` with a local implementation over `KeyValueStore`. It's designed so a backend can replace it.
- `usePacking.ts`: `useReducer`, loads once and saves on every change.

**Reusability for a separate to-do list**

| Piece                                                                    | Reusable as-is? | Notes                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ProfileSwitcher`                                                        | **Yes, almost** | Props are `selected`, `onSelect`, `summaries: Record<TravelerId,string>`. It only depends on the travelers and avatars. The `role="group" aria-label="Whose list"` text is generic enough. |
| `safeStorage`, repository pattern, `defaultIdGenerator`, `normalizeName` | Yes             | `normalizeName` lives in `packing/model.ts`, which couples it to packing                                                                                                                   |
| Toasts / undo pattern (`toastStore`)                                     | Yes             |                                                                                                                                                                                            |
| `PackingItemRow`                                                         | **No**          | Typed to `PackingItem`, with the Have/To-buy chip and the category select baked in                                                                                                         |
| `AddItemForm`, `FilterBar`, `TemplateOffer`                              | No              | Typed to the packing categories, ownership and status filters. Structure and CSS (`.add-item`, `.chip-button`, `.filters__group`) are reusable                                             |
| `BackupPanel`                                                            | Partly          | Calls packing `parseImport`/`serializeExport` directly. It would need injected serialize/parse functions plus an app id                                                                    |
| Progress UI                                                              | Partly          | It's inline markup in `PackingPage` (native `<progress class="pack-progress">` plus a "N to buy" badge), not a component                                                                   |
| reducer / selectors                                                      | No              | Packing-specific. The patterns (restore-at-index, filters) are worth copying or generalizing                                                                                               |

## 6. Visual system

**Design tokens** (`src/styles/tokens.css`). Components use the variables only.

- **Colors:**
  - Base: `--color-bg`, `-bg-sky`, `-surface`, `-surface-muted`, `-border`, `-ink`, `-ink-muted`.
  - Primary `#1059a8`: `--color-primary`, `-primary-ink`, `-primary-soft`.
  - Accent "Saperavi wine" `#9b1b40`: `--color-accent`, `-accent-soft`.
  - Other: `--color-sun`, `--color-focus` `#ff9f1c`, `--shadow-card`.
  - Map: `--map-snow`, `-ridge`, `-pine`, `-casing`, `-lift`, `-label`, `-label-halo`, `-hotel`; runs `--run-novice|easy|intermediate|advanced|unknown`.
  - Atmosphere: `--backdrop-veil`, `--snowflake`, `--snowflake-glow`.
- **Typography:**
  - `--font-display`: Fredoka, self-hosted via `@font-face` in the same file.
  - `--font-body`: system UI.
  - Sizes: `--text-sm|md|lg|xl|2xl|countdown`; the last two use clamp().
- **Spacing and shape:** `--space-1…7` (0.25–3 rem), `--radius-sm|md|lg|pill`.
- **Layout:** `--content-max` 46 rem, `--header-height` 3.5 rem, `--tab-bar-height` 4 rem, `--gutter`. `--breakpoint-desktop` is documentation only; media queries repeat `56rem` literally.
- **Dark mode:** a single `@media (prefers-color-scheme: dark)` block redefines the color tokens. There's **no manual theme toggle**.
- **Motion:** `prefers-reduced-motion` disables the snowfall and transitions/animations globally (`global.css`).
- **Where the CSS lives:** all component CSS is in one `src/styles/global.css` (about 1,835 lines, BEM-ish class names, sections marked with comments). There are no CSS modules.

**Avatars**

- `src/avatars/FaceArt.tsx`: one parametric SVG face in a 120×120 coordinate space. It handles hair styles short/long/bun/wavy, eyes, lashes, freckles, glasses, an optional shoulders/jacket, and optional goggles.
- Traits per traveler come from `CHARACTERS` in `src/data/characters.ts`: skin, hair, eyes, jacket color and booleans.
- `src/avatars/Avatar.tsx`:
  - `AvatarFace({ id, size, decorative?, class? })`: a round "sticker" portrait.
  - `AvatarSkier({ … })`: the full-body ski pose (viewBox 120×150).
  - Both are labelled with `role="img"` and an `aria-label` unless `decorative`.
- Used in:
  - Home "The crew" (`components/Crew.tsx`).
  - Packing `ProfileSwitcher`.
  - The game picker and overlays.
  - The game sprite: `game/sprites.ts` rasterizes `AvatarSkier` through a data-URI image.
- Each traveler's jacket color doubles as their UI accent (`--member-color`).

**Ski map**

- **Source:** OpenStreetMap through the Overpass API. `scripts/fetch-pistes.ts` (`npm run fetch:pistes`) writes `src/data/pistes.json` (12 kB, 3.9 kB gzipped). The data is ODbL; attribution is in the footer, the map page and the README.
- **Coordinates:**
  - Equirectangular projection around the mid-latitude.
  - Bounding box: S 42.445, W 44.44, N 42.56, E 44.525.
  - Map units: width **1000** × height **1835**, north up, about 7 m per unit.
  - Lines simplified with Douglas–Peucker (tolerance 1.2).
  - Projection helpers are in `scripts/lib/geometry.ts`: `createProjection`, `haversineM`, `simplify`.
- **Data** (`src/lib/map/types.ts`, `PisteMap`):
  - `runs[]`: 50 runs as `{ id, name, difficulty, path (SVG d), lengthM, area? }`.
  - `lifts[]`: 16 lifts as `{ id, name, kind, path, stations [bottom, top], lengthM }`.
  - `pois[]`: 8 points of interest as `{ id, name, kind 'hotel'|'monument'|'peak', x, y, eleM? }`.
- **Renderer** (`src/components/map/PisteMapSvg.tsx`): an original stylized SVG with these layers:
  - snow
  - gradient ridges under each peak
  - decorative pines
  - runs (casing + line + an invisible wide "hit" path)
  - lifts (dashed line, station dots, hit path)
  - optional labels
  - POI markers
- **Addressable elements:** every run group and lift is a `<g data-key="…">`. Run keys look like `run:<name>:<difficulty>`; lift keys come from `liftKey(lift)` in `lib/map/catalog.ts`. The props `selectedKey` (highlight one, dim the rest), `viewBox` and `labels` control rendering.
- **Uses:**
  - **Background:** `MapBackground` crops to `viewBox "330 700 620 1000"`, blurs it and adds a veil. Markers and hit areas are hidden there.
  - **Map page:** `MapPage` adds zoom, tap-to-select, lists and attribution.
- **Elevation data:**
  - Only the 6 named peaks have `eleM`: Sadzele Main 3307, Sadzele Middle 3268, Sadzele West 3258, Didi Bidara 3174, Patara Bidara 3011, Kudebi 3006.
  - Runs, lifts, stations and the hotel have **no elevation**. There's no DEM.
  - The facts give the ski area as about 1,990–3,280 m (the Pirveli base is about 1,990 m).
- **As a base for a snow/temperature illustration:** possible, but it's a **top-down map**, so altitude isn't visual.
  - **Recommended:** a new side-profile or "3 bands" mountain illustration component. It can reuse the tokens, ridge style, POI glyphs and data-key/selection approach, but not `PisteMapSvg` itself.
  - **Optional:** to place zones on the top-down map, extend `fetch-pistes.ts` to add elevations for lift stations. The Open-Meteo Elevation API is a free option **(unverified)**.

**Shared UI** (there are no modal, dialog or tabs components by design)

| UI             | Where                                                                                                                                                 | Notes                                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card           | `.card` class in global.css                                                                                                                           |                                                                                                                                                                 |
| Buttons        | `.button`, `.button--primary`, `.button--danger`, `.icon-button`, `.icon-button--danger`, `.chip-button[aria-pressed]`, `.link-button`, `.button-row` | No Button component; plain markup + classes                                                                                                                     |
| Switch         | `.switch[role=switch]` (FactsPage)                                                                                                                    | Inline markup                                                                                                                                                   |
| Toast          | `lib/toast/toastStore.ts` + `components/ToastHost.tsx`                                                                                                | `toasts.show({ title?, message, emoji?, action?, durationMs })`; max 2 visible; above the tab bar on mobile, bottom-left on desktop                             |
| Confirmation   | Inline `.confirm` block (BackupPanel)                                                                                                                 | Native `alert/confirm` are banned (CLAUDE.md)                                                                                                                   |
| Page header    | `components/PageHeader.tsx`                                                                                                                           | h1 + back link + focus management                                                                                                                               |
| Loading/error  | `lazyPage` ("Loading…", alert + retry); `.page-loading`; `.empty-state`, `.empty-note`                                                                |                                                                                                                                                                 |
| Notes          | `.note`, `.note--warning`                                                                                                                             |                                                                                                                                                                 |
| Icons          | `components/Icon.tsx`                                                                                                                                 | 18 stroke icons: home plane backpack game more bulb map chat arrowLeft bag clock pencil trash download upload cart plus snowflake. Add new ones as path strings |
| Lists of cards | `components/SectionCards.tsx`                                                                                                                         |                                                                                                                                                                 |
| Overlay panel  | Game-specific `.game__overlay` / `.game__panel`                                                                                                       | Closest thing to a modal                                                                                                                                        |

## 7. Backend / serverless proxy

**Provider and location**

- **Cloudflare Workers AI**, model `@cf/meta/llama-3.1-8b-instruct-fp8`, set by the `MODEL` var in `worker/wrangler.toml`.
- It's called through the **`AI` binding**, so there is **no API key or secret**.
- Code lives in `/worker`, a separate npm package (TS 7, Vitest, Wrangler 4).

**Endpoints** (`worker/src/index.ts`, `handleRequest`)

- `GET /health` → `{ ok: true }`.
- `POST /chat` with `{ messages: [{ role: 'user'|'assistant', content }] }` → `{ reply }`.
- `OPTIONS /chat` → CORS preflight.
- Anything else → 404.
- Status codes: 400 bad shape/JSON, 403 origin not allowed, 405 method, 413 too long, 429 rate-limited (`Retry-After: 60`), 502 model error, 503 daily quota exhausted.

**Config names** (names only)

| Kind               | Name                 | Purpose                                                                                                                   |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Binding            | `AI`                 | Workers AI                                                                                                                |
| Binding            | `RATE_LIMITER`       | Rate limit: 10 requests per 60 s per `CF-Connecting-IP`; `namespace_id "1001"`                                            |
| Var                | `ALLOWED_ORIGINS`    | `https://ofekfa.github.io,http://localhost:5173,http://localhost:4173`                                                    |
| Var                | `MODEL`              | AI model id                                                                                                               |
| Secrets            | none                 |                                                                                                                           |
| Frontend build var | `VITE_ASSISTANT_URL` | GitHub repo **variable** (not a secret), read in `deploy.yml`; local dev uses `.env.local` (documented in `.env.example`) |

**Limits** (`worker/src/limits.ts`)

- `MAX_MESSAGE_CHARS` 500, `MAX_MESSAGES` 10, `MAX_BODY_BYTES` 16000, `MAX_OUTPUT_TOKENS` 320, `TEMPERATURE` 0.4.
- **Caching:** none.
- **Rate limit:** measured as approximate. The free binding is eventually consistent across Cloudflare locations, and a burst only got 429s after about 75 requests.

**Deployment**

- **Manual:** `cd worker && npx wrangler deploy`, using Ofek's OAuth login on his machine.
- CI only typechecks and tests the Worker (the `worker` job in `ci.yml`). **CI doesn't deploy it**, and there's no `CLOUDFLARE_API_TOKEN` secret.

**Extending with more routes**

- **Feasible.** The handler is a small `if`-based router (`/health`, `/chat`). Before adding routes, it should be refactored into:
  - a route table;
  - per-route CORS/origin/rate-limit middleware;
  - a JSON response helper (already `json()`).
- **Hiding keys:** add secrets with `npx wrangler secret put NAME` and read them as `env.NAME`.
- **Caching:** cache upstream responses with the Workers Cache API (`caches.default`) or `Cache-Control`, which avoids hitting upstream APIs and the rate limits **(unverified on the free plan, but widely used)**.
- **Scheduled refresh:** Cron Triggers are also available on the free plan, e.g. to refresh rates or a calendar into KV **(unverified)**.
- **Free-tier figures** (from Phase 6 research, docs checked 2026-10):
  - Workers: 100,000 requests/day, 10 ms CPU per request (time waiting on fetch doesn't count), 50 subrequests per invocation.
  - Workers AI: 10,000 neurons/day, which is several hundred chat turns with the 8B model.
  - KV free: about 100k reads and 1k writes per day **(unverified)**.
  - Weather, currency or calendar proxies with caching would use a tiny fraction of the request budget.

**System prompt** (`worker/src/prompt.ts`, `buildSystemPrompt(now)`)

- It **imports `src/data/trip.ts` and `src/data/facts.ts` at build time**, so they're bundled into the Worker. It formats both flight legs in local airport times and adds every fact's `text`.
- This is "automatic" only in the sense that the data is shared source. **Any change to trip.ts or facts.ts needs a manual Worker redeploy**, or the assistant goes stale.
- Live data (weather, itinerary) would have to be fetched **at request time inside the Worker** and appended to the prompt, which costs latency and AI input tokens. Alternatively the client could send it as context. Either way, keep it short.

## 8. Security & external resources

- **Content Security Policy: none.** There's no CSP `<meta>` in `index.html`, and GitHub Pages can't set response headers. Nothing currently blocks embedding iframes or fetching third-party APIs.
  - If a CSP is added later (meta tag only, and `frame-ancestors` isn't supported in meta), it must allow:
    - `connect-src` for the Worker origin and any API;
    - `frame-src`/`img-src` for webcam hosts;
    - `'self'` for fonts.
- **External resources at runtime:**
  - **Worker** `https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev`, the only `fetch()` target: `src/assistant/client.ts`, reached through `/chat`.
  - **Outbound links only:** fact `source` links (Wikipedia, UNESCO, WHO, …) and the OSM/OpenSkiMap attribution links.
  - **No** third-party scripts, stylesheets, fonts, analytics or iframes. The font is self-hosted.
  - **Web Speech API:** browser built-in. In Chrome, recognition audio goes to the browser vendor's service.
- **Third-party APIs:**
  - Runtime: only Cloudflare Workers AI, server-side through the binding.
  - Build-time: only Overpass (OSM), in `scripts/fetch-pistes.ts`, run manually.
- **Privacy rule** (CLAUDE.md): first names and public flight info only. **The site is public**, which matters for the calendar itinerary (§10).

## 9. Quality & workflow

**Commands**

- Site: `npm run dev`, `lint` (ESLint + `prettier --check`), `format`, `typecheck` (app, `scripts/` and `src/sw` tsconfigs), `test` (Vitest run), `build` (typecheck + Vite), `preview`, `fetch:pistes`, `fetch:rates` (run by the Pages deploy), `fetch:dish-images` (rarely, then review by eye).
- Worker: `npm test`, `npm run typecheck`, `npx wrangler dev|deploy|tail`.

**Tests: 280 site + 55 Worker** (as of `v1.9.0`; the table below dates from `v1.0.0`), all pure or unit-level. There are no component, DOM or E2E tests; headless puppeteer checks are run by hand.

| File                                                         | Covers                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `lib/time/countdown.test.ts`, `format.test.ts`               | Trip phases and day boundaries in the Tbilisi zone; formatting in zones; durations |
| `lib/router/hashRouter.test.ts`, `navigation.test.ts`        | Hash parsing; tab bar has 5 items; More highlighting                               |
| `lib/storage/safeStorage.test.ts`                            | Prefixing, throwing storage, missing storage                                       |
| `lib/packing/*.test.ts`                                      | Reducer, selectors, import/export validation, repository                           |
| `lib/facts/rotation`, `settings`, `carousel`                 | Shuffle bag, gate, intervals, mute persistence, swipe/keys/wrap                    |
| `lib/toast/toastStore.test.ts`                               | Auto-dismiss, max visible                                                          |
| `lib/map/catalog.test.ts`, `scripts/lib/geometry.test.ts`    | Run grouping, lengths; projection, simplify, haversine                             |
| `lib/speech/recognition.test.ts`, `assistant/client.test.ts` | Speech fallback, error mapping; history trimming, status mapping                   |
| `game/engine.test.ts`, `highScores.test.ts`                  | Physics, spawn/pool, crash/lives, restart; ranking/storage                         |
| `data/*.test.ts`                                             | Characters complete and distinct; facts schema/limits; template validity           |
| `worker/test/index.test.ts`                                  | CORS, 403/405/413/429/400, quota 503 vs 502, health, history trim, prompt contents |

**CI** (`.github/workflows/`)

- `ci.yml` runs on PRs:
  - **`check` job:** `npm ci`, then lint, typecheck, test, test again with `TZ=America/Los_Angeles`, then build.
  - **`worker` job:** `npm ci` in `worker/`, then typecheck and test.
- `deploy.yml` runs on push to `main` and on manual dispatch: `npm ci`, lint, test, build (with `VITE_ASSISTANT_URL` from repo vars), then `configure-pages`, `upload-pages-artifact` (`dist`), `deploy-pages`.
  - It doesn't re-run the TZ test or Worker checks, which is fine because those run on the PR.

**Conventions actually followed**

- `main` + short-lived `feat/*`, `fix/*`, `perf/*`, `docs/*` branches.
- **Conventional Commits** with `Co-Authored-By: Claude …` trailers.
- One PR per feature slice, with a description + checklist.
- Wait for green CI, then `gh pr merge --squash --delete-branch`.
- After each phase: a `docs/phase-N-status` PR updating `PLAN.md`, then an annotated tag; `v1.0.0` also got a GitHub Release.
- A `CONTRIBUTING.md` doesn't exist.

**`CLAUDE.md` summary**

- Commands table.
- Architecture: `data/` = content, `lib/` = pure + tested, `navigation.ts` = metadata, hash routing, lazy heavy pages.
- Conventions:
  - strict TypeScript, no `any`, no magic numbers;
  - **time** via `formatInZone`, never the viewer's zone;
  - **storage** only through `appStore` + repository interfaces;
  - **a11y**: one h1 via PageHeader, aria-current, visible focus, reduced motion, `label htmlFor`, no native dialogs, no `href="#…"` anchors;
  - **privacy**, **secrets** (`wrangler secret put`), **content** (own words + sources; OSM attribution; never the official piste map).
- Git workflow.
- **Quality bar:** Lighthouse mobile perf ≥ 90 and a11y = 100 on every route; axe 0 violations (light/dark); no overflow at 375 px; game 60 fps at 4× throttle; CLS 0; no render-blocking third-party CSS/fonts.

**Bundle** (last local production build; gzip sizes)

- Main chunk: `index` JS 18.4 kB + CSS 7.0 kB.
- Lazy chunks:

| Chunk         | gzip   |
| ------------- | ------ |
| GamePage      | 6.8 kB |
| PackingPage   | 5.8 kB |
| facts data    | 5.2 kB |
| pistes data   | 3.9 kB |
| AssistantPage | 3.4 kB |
| MapPage       | 2.1 kB |
| FactsPage     | 1.7 kB |

- Font: 29 kB woff2, preloaded.
- Live Lighthouse (mobile): performance **98–100**; accessibility, best practices and SEO **100** on all 7 routes; FCP about 1 s; CLS 0.

**Known open performance/a11y issues**

- No known failures.
- Not yet done: a check on real phones (iOS Safari speech, real-device game feel).

## 10. Known issues & recommendations

**Bugs, tech debt and fragile areas**

1. **Worker prompt drift:** the Worker bundles `trip.ts`/`facts.ts` at deploy, and deploys are manual. Changes to trip data or facts don't reach the assistant until someone runs `wrangler deploy`.
   - Recommend a CI deploy job: on push to `main` when `worker/**`, `src/data/**` or `src/lib/facts/types.ts` change, using a `CLOUDFLARE_API_TOKEN` GitHub secret.
2. **Desktop header nav doesn't scale:** all sections render inline with no overflow handling (see §3). This needs fixing before adding about 5 pages.
3. **Rate limiter is approximate:** ~75-request bursts got through before any 429. The free AI allowance is the hard cap. New routes that hit paid or keyed APIs need caching, and possibly stricter per-route limits.
4. **No CSP.** That's fine today, but decide deliberately when adding iframes (webcams) and third-party fetches.
5. **Storage migration:** only packing has a version, and a version mismatch resets to empty. Add a tiny migration helper before changing any stored schema.
6. **TypeScript version mismatch:** 6.0 in the site vs 7.0 in `worker/`. It works today, but they should be aligned.
7. **Unused or dead code:**
   - The `jsdom` devDependency is unused.
   - `ComingSoonPage` and the `comingSoon` flag are unused. Keep them for staged rollouts, or remove them.
   - `--breakpoint-desktop` is unused in media queries.
   - `MAX_FIELD_WIDTH` (game) is duplicated as `30rem` in CSS.
8. **Stale docs:**
   - **`PLAN.md`:**
     - Deviations say Maya has green eyes; she now has brown eyes and glasses.
     - The Phase 5 note says the "throttled trace is still to do"; it was done in Phase 7 via 4× emulation.
     - The original plan body still mentions a Groq fallback and a per-IP daily cap.
     - The Phase 2 pinch-zoom bullet is out of order.
   - **`CLAUDE.md`:**
     - The `typecheck` row omits `-p scripts`.
     - Worker commands are missing.
     - "src/lib … and later packing, facts and speech" is outdated.
9. **Tests:** no component or E2E tests. The UI was verified manually and with ad-hoc headless scripts that aren't in the repo.
10. **Packing filter state is per page visit:** not persisted, by design.

**Where each upcoming feature should live**

| Feature                               | Recommended placement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Weather & snow + webcams**       | <ul><li>**Data:** a new Worker route, e.g. `GET /weather`, that proxies a keyless forecast API and caches for 15–30 min. Open-Meteo is a candidate: forecast, `snowfall`, `snow_depth`, and an `elevation=` parameter for 3 altitudes **(verify the variables, accuracy and terms)**. Also returns "last snowfall"; snow depth is model-estimated. Client: `src/lib/weather/` (types, pure formatters/aggregation + tests) and `src/pages/WeatherPage.tsx` (lazy), with zone config (name, altitude, lat/lon, webcam URL) in `src/data/zones.ts`.</li><li>**Illustration:** a new `components/weather/MountainZones.tsx` side-profile SVG with 3 altitude bands (base ≈ 2,000 m by Marco Polo/Pirveli, mid, top ≈ 3,000+ m) and overlays for depth and temperature, reusing the tokens and map styling.</li><li>**Webcams:** links or images/iframes from public sources. Confirm which hosts allow embedding and their terms, and that a Marco Polo cam actually exists **(unverified)**. Lazy-load them and pause refresh when hidden.</li><li>Feed a short weather summary into the assistant at request time.</li></ul> |
| **2. Georgian words**                 | Extend `src/lib/facts/types.ts` (new topic + discriminated union, §4) and `src/data/facts.ts`. Update the FactsPage card renderer and the tests (source rule). Pop-ups and the assistant pick them up through `text`. Optionally a "Words" filter preset. Redeploy the Worker.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **3. Currency converter**             | <ul><li>Pure `src/lib/currency/` (conversion, rounding, the quick-reference table generator + tests) and `src/pages/CurrencyPage.tsx` (lazy).</li><li>**Rates:** a Worker route `GET /rates` that caches once a day. A source with **GEL** is needed. The ECB reference rates (used by many free APIs) **do not include GEL (unverified)**; the National Bank of Georgia publishes official GEL rates incl. ILS and EUR **(endpoint and CORS unverified)**.</li><li>Cache the last rates in `appStore` (e.g. `currency:rates`) with a timestamp for offline use, and show "rates as of …".</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **4. Pre-flight to-do list**          | Extract a small **generic checklist toolkit** before building, to avoid copying packing:<ul><li>`ProfileSwitcher` → `components/common/`.</li><li>A `ProgressSummary` component from the inline packing markup.</li><li>`BackupPanel` with injected serialize/parse.</li><li>`normalizeName` / `defaultIdGenerator` → `lib/list/`.</li></ul>Then add `src/lib/todo/` (model with per-traveler **and** shared/group items, due-before-flight dates, reducer, repository with key `todo` + version) and `src/pages/TodoPage.tsx` with a starter template (insurance, eSIM/roaming, check-in opens…). Note: check-in timing per airline isn't verified. Lists stay per-device, so shared items won't sync without a backend.                                                                                                                                                                                                                                                                                                                                                                                                   |
| **5. Itinerary from Google Calendar** | **Privacy first: the site is public**, so anything the Worker returns is public. Options: <ul><li>Read the calendar's **secret iCal address** in the Worker (`wrangler secret put CALENDAR_ICS_URL`), parse VEVENTs server-side, return only whitelisted fields (title, start/end, location) as JSON with caching (`GET /itinerary`).</li><li>Or make the calendar public and use an API key, kept as a Worker secret.</li></ul>The client (`src/lib/itinerary/` + `ItineraryPage`) renders days in `Asia/Tbilisi` via `formatInZone`. Handle all-day events and recurring events (RRULE) carefully, or limit support. The Home "during the trip" state could show "today's plan".                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Refactors to do first** (in this order)

1. **Navigation:** decide which sections stay in the 5-tab mobile bar (e.g. Trip/Itinerary might deserve a tab), and add **desktop nav overflow handling** (a "More" dropdown or only `inTabBar` items + More). Group the "More" page cards (Plan / Fun / Tools).
2. **Worker router + CI deploy:**
   - Refactor `handleRequest` into a route table with shared CORS/origin/rate-limit middleware and a caching helper.
   - Add a CI deploy job with a `CLOUDFLARE_API_TOKEN` secret, so data and new routes stay in sync.
   - Decide whether to add a CSP.
3. **Generic list toolkit** (see feature 4), plus a small storage migration helper.
4. **Fact type → discriminated union** (feature 2), before adding the words.
5. **Housekeeping:** fix the stale `PLAN.md`/`CLAUDE.md` lines, align TypeScript versions, drop `jsdom` or start using it for component tests.
