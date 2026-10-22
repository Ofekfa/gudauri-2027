# CLAUDE.md — Gudauri 2027

Companion site for a 4-person ski trip. Static Preact + TypeScript app on GitHub Pages; a Cloudflare Worker (`/worker`) proxies the AI assistant and serves cached live data (`/itinerary`, `/weather`, `/rates`). The full plan and phase status live in `PLAN.md`.

## Commands

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `npm run dev`       | Vite dev server at http://localhost:5173/gudauri-2027/            |
| `npm run lint`      | ESLint + Prettier check (fails CI if unformatted)                 |
| `npm run format`    | Prettier write                                                    |
| `npm run typecheck` | `tsc --noEmit` for the app and for `scripts/` (own tsconfig)      |
| `npm test`          | Vitest (run once). CI also runs it with `TZ=America/Los_Angeles`. |
| `npm run build`     | Typecheck + production build to `dist/`                           |

| `npm run fetch:pistes` | Regenerate `src/data/pistes.json` from OpenStreetMap (rarely) |

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
- Heavy features (game, assistant, map) are lazy-loaded with dynamic `import()`.

## Conventions

- TypeScript strict; no `any`. Typed data models live next to their data.
- No magic numbers: name them as constants (module-level `const` or `constants.ts`).
- **Time:** never use the viewer's local zone for trip times. Parse with `Date.parse(iso)`; display with `formatInZone(iso, airport.timeZone)`. Inject `now` into pure functions for testability.
- **Storage:** only through `src/lib/storage/safeStorage.ts` (`appStore`). It never throws and falls back to memory. Feature state goes behind a repository interface so a backend can replace it. Structured data is stored with `loadVersioned`/`saveVersioned` (inline `version` + migrations).
- **Accessibility:** semantic HTML, every page has one `<h1>` via `PageHeader`, `aria-current="page"` on active nav, visible `:focus-visible`, respect `prefers-reduced-motion`, labels on icon-only controls. Don't use `href="#..."` for in-page anchors (the hash is the router). Write `<label htmlFor>` (not Preact's `for`) so jsx-a11y can verify label/control pairs. Never use `alert`/`confirm`/`prompt`: show inline confirmations or toasts (`src/lib/toast`).
- Comments only where the "why" isn't obvious.
- **Privacy:** first names and public flight info only. No surnames, booking refs, seats, passport or phone data.
- **Secrets:** never in code or git. `.env*` is ignored; document variables in `.env.example`. The Worker uses `wrangler secret put`.
- **Content:** facts are written in our own words, each with a `source` URL. Never hotlink or copy the official piste map. Map data comes from OpenStreetMap (ODbL) and needs attribution.

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
