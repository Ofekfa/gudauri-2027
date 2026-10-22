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
- **Background music:** `src/lib/music/` — `machine.ts` (pure reducer; playback is derived, so nothing plays once muted), `shuffleBag.ts`, `settings.ts`, `player.ts` (lazy chunk; owns playback, Media Session) and `musicStore.ts` (always loaded, tiny: creates the single audio element and unlocks it synchronously inside the first gesture, then lazy-loads the player). `src/lib/speech/activity.ts` lets voice features pause/duck music. `MusicControl` sits in the header.
- **Detail routes:** a section can take one detail segment (`#/food/khinkali`) via `PARAM_PAGES` in `app.tsx` and `matchRoute` in `hashRouter.ts`; navigation, titles and fact pop-ups follow the section (`basePath`). No router library.
- **Offline:** `src/sw/sw.ts` (built to an unhashed `sw.js` by `build/serviceWorkerPlugin.ts`) precaches every built file and `public/` asset; routing logic is in `src/sw/routing.ts` (tested). It never caches the Worker or other origins: live data stays offline-capable through each feature's own versioned copy in storage. The worker must not import app modules (the build fails if it would share a chunk); it has its own tsconfig with WebWorker types. Updates show a sticky "New version available" toast (`src/lib/pwa/register.ts`). `src/data/fallbackRates.ts` is regenerated by `npm run fetch:rates` on each deploy.

## Conventions

- TypeScript strict; no `any`. Typed data models live next to their data.
- No magic numbers: name them as constants (module-level `const` or `constants.ts`).
- **Time:** never use the viewer's local zone for trip times. Parse with `Date.parse(iso)`; display with `formatInZone(iso, airport.timeZone)`. Inject `now` into pure functions for testability.
- **Storage:** only through `src/lib/storage/safeStorage.ts` (`appStore`). It never throws and falls back to memory. Feature state goes behind a repository interface so a backend can replace it. Structured data is stored with `loadVersioned`/`saveVersioned` (inline `version` + migrations).
- **Accessibility:** semantic HTML, every page has one `<h1>` via `PageHeader`, `aria-current="page"` on active nav, visible `:focus-visible`, respect `prefers-reduced-motion`, labels on icon-only controls. Don't use `href="#..."` for in-page anchors (the hash is the router). Write `<label htmlFor>` (not Preact's `for`) so jsx-a11y can verify label/control pairs. Never use `alert`/`confirm`/`prompt`: show inline confirmations or toasts (`src/lib/toast`).
- Comments only where the "why" isn't obvious.
- **Privacy:** first names and public flight info only. No surnames, booking refs, seats, passport or phone data.
- **Secrets:** never in code or git. `.env*` is ignored; document variables in `.env.example`. The Worker uses `wrangler secret put`.
- **Content:** facts and dishes are written in our own words, each with `https` sources (dishes need two). Never hotlink or copy the official piste map. Map data comes from OpenStreetMap (ODbL) and needs attribution. Diet flags describe the usual version, conservatively; put variations in `dietNote`.
- **Images:** only from Wikimedia Commons under CC0, public domain, CC BY or CC BY-SA (the script refuses anything else). Pin each file in `scripts/dish-image-sources.ts` with alt text that describes the actual photo, and check every image by eye (Commons categories contain mislabeled photos). Output is AVIF + WebP at 320/640 px, ≤ 60 kB each (tested), in `<picture>` with width/height and `loading="lazy"`. Never hotlink. No suitable photo means the drawn illustration, never a wrong photo. Large media isn't precached; the service worker caches it at runtime.
- **Audio:** only tracks under the licences in `ALLOWED_LICENSES` (`src/data/tracks.ts`), listed in `scripts/track-sources.ts` with licence, source page and attribution; run `npm run analyze:tracks` after changes. Stream from the original host (Commons/archive.org MP3); never commit audio, never re-encode or trim (ND licences). Even out loudness with `gainDb` applied as volume. Load nothing audio-related before the first user gesture, never play after the user muted, respect Save-Data, and skip failing tracks. Third-party players (YouTube) are tap-to-load from official channels only, and background music steps aside while one is open.
- **Licensing and credits:** every third-party asset has its author, licence, licence URL and source recorded in data, and is listed on `#/credits` (and next to the asset where practical). Say what we changed (e.g. "Cropped and resized") for CC BY/BY-SA.

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
