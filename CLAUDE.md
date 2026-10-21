# CLAUDE.md — Gudauri 2027

Companion site for a 4-person ski trip. Static Preact + TypeScript app on GitHub Pages; an optional Cloudflare Worker (`/worker`, Phase 6) proxies the AI assistant. The full plan and phase status live in `PLAN.md`.

## Commands

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `npm run dev`       | Vite dev server at http://localhost:5173/gudauri-2027/            |
| `npm run lint`      | ESLint + Prettier check (fails CI if unformatted)                 |
| `npm run format`    | Prettier write                                                    |
| `npm run typecheck` | `tsc --noEmit`                                                    |
| `npm test`          | Vitest (run once). CI also runs it with `TZ=America/Los_Angeles`. |
| `npm run build`     | Typecheck + production build to `dist/`                           |

Run lint, typecheck, test and build before every PR.

## Architecture

- `src/data/` holds **all trip facts and content data**. `trip.ts` is the single source of truth: times are ISO 8601 with explicit offsets.
- `src/lib/` holds pure, framework-free logic with unit tests (`*.test.ts` next to the file): time, router, storage, and later packing, facts and speech.
- `src/navigation.ts` has route metadata only (titles, icons, tab-bar placement). `src/app.tsx` maps paths to page components.
- `src/components/` has reusable UI; `src/pages/` has one component per route.
- `src/styles/tokens.css` has design tokens (light + dark). Components use tokens only, never raw colors.
- Routing is **hash-based** (`#/flights`) so refresh and deep links never 404 on GitHub Pages.
- Heavy features (game, assistant, map) are lazy-loaded with dynamic `import()`.

## Conventions

- TypeScript strict; no `any`. Typed data models live next to their data.
- No magic numbers: name them as constants (module-level `const` or `constants.ts`).
- **Time:** never use the viewer's local zone for trip times. Parse with `Date.parse(iso)`; display with `formatInZone(iso, airport.timeZone)`. Inject `now` into pure functions for testability.
- **Storage:** only through `src/lib/storage/safeStorage.ts` (`appStore`). It never throws and falls back to memory. Feature state goes behind a repository interface so a backend can replace it.
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
- Tag `v0.N.0` at the end of each phase and update `PLAN.md` status.
