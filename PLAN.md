# PLAN — Gudauri 2027

## Status

| Phase | Scope                                                                    | Status         | Tag    |
| ----- | ------------------------------------------------------------------------ | -------------- | ------ |
| 1     | Scaffold, tooling, CI, Pages, nav shell, trip config, countdown, flights | 🚧 In progress | v0.1.0 |
| 2     | Avatars, map background, visual identity                                 | —              | v0.2.0 |
| 3     | Packing list                                                             | —              | v0.3.0 |
| 4     | Fun facts + pop-ups                                                      | —              | v0.4.0 |
| 5     | Skiing game                                                              | —              | v0.5.0 |
| 6     | Voice AI assistant + Worker proxy                                        | —              | v0.6.0 |
| 7     | Polish: a11y, perf, mobile QA                                            | —              | v1.0.0 |

### Deviations from the original plan

- Phase 1: the router is in-house (`src/lib/router/hashRouter.ts`). Route metadata lives in `src/navigation.ts`, and the "More" tab is a page (`#/more`) rather than a pop-up sheet, which is simpler to navigate on phones.
- Phase 1: ESLint is pinned to v9 because `eslint-plugin-jsx-a11y` doesn't support v10 yet.

---

## Context

A public, mobile-first companion site for a 4-person ski trip (Ofek, Ron, Roy, Maya) to Gudauri, Georgia, 24–28 Feb 2027. Empty project directory; greenfield. Hosted on GitHub Pages (static) with a tiny serverless proxy for a free AI model.

**Decisions (confirmed):** English (LTR) · repo `gudauri-2027` (public) · packing lists per-device (localStorage behind a swappable interface + JSON export/import) · Preact + TypeScript.

Env: Node 24.8, npm 11.6, git 2.39, gh authenticated.

---

## 1. Architecture

- **Vite + Preact + TS** (`@preact/preset-vite`). Runtime deps: `preact` only (+ `preact-iso` or a ~60-line in-house hash router — choose in-house to keep deps minimal).
- **Routing:** hash-based (`#/`, `#/flights`, `#/packing`, `#/facts`, `#/map`, `#/game`, `#/assistant`). Refresh/deep links never 404 on Pages. Router updates `document.title` and moves focus to the page `<h1>` on navigation (screen-reader friendly).
- **Lazy loading:** `game` and `assistant` (and `map` page) are `lazy()` dynamic imports → separate chunks.
- **Game:** framework-free Canvas module mounted by a thin Preact wrapper.
- **Proxy:** `/worker` — Cloudflare Worker (separate package, own `wrangler.toml`, README, tests). Provider chosen in §6.
- **Time handling:** all trip times are ISO strings with offsets in `trip.ts`; parsed via `Date.parse` (absolute instants). Display formatting uses `Intl.DateTimeFormat` with explicit `timeZone: 'Asia/Jerusalem' | 'Asia/Tbilisi'` — never viewer-local. A `now()` clock is injected so tests can fake time.

## 2. Folder structure

```
/
├─ .github/workflows/{ci.yml,deploy.yml}
├─ public/ (favicon, og-image, 404.html → redirect to #/)
├─ scripts/fetch-pistes.ts        # one-off: download OSM/OpenSkiMap data → simplify → src/data/pistes.json
├─ src/
│  ├─ main.tsx, app.tsx
│  ├─ data/ trip.ts · facts.ts · packingTemplate.ts · pistes.json · characters.ts
│  ├─ lib/
│  │  ├─ time/ countdown.ts (pure: phase + remaining parts) · format.ts
│  │  ├─ router/ hashRouter.ts · routes.ts
│  │  ├─ storage/ Storage.ts (interface) · localStorageAdapter.ts · safeStorage.ts
│  │  ├─ packing/ model.ts · reducer.ts · selectors.ts · importExport.ts
│  │  ├─ facts/ rotation.ts (rate limiter + shuffle-bag, pure)
│  │  └─ speech/ recognition.ts · synthesis.ts (feature-detected)
│  ├─ components/ Layout · Header · BottomTabBar · PageTitle · Toast · Avatar · MapBackground · Icon
│  ├─ avatars/ ofek.tsx ron.tsx roy.tsx maya.tsx (+ ski poses) · parts.ts (shared face/skin/hair tokens)
│  ├─ pages/ Home(Countdown) · Flights · Packing · Facts · Map · Game · Assistant · NotFound
│  ├─ game/ engine.ts · loop.ts · entities.ts · input.ts · spawn.ts · render.ts · constants.ts · highScores.ts
│  ├─ assistant/ ChatPanel.tsx · client.ts · systemPrompt.ts
│  └─ styles/ tokens.css (colors, spacing, radii; light+dark) · global.css
├─ tests/ (or co-located *.test.ts)
├─ worker/ src/index.ts · src/rateLimit.ts · src/cors.ts · wrangler.toml · README.md · test/
├─ CLAUDE.md · README.md · PLAN.md · .env.example · .gitignore · eslint.config.js · .prettierrc
```

## 3. Data models (TypeScript)

```ts
// trip.ts
type TravelerId = 'ofek' | 'ron' | 'roy' | 'maya';
interface Traveler { id: TravelerId; name: string; note?: string }
interface FlightLeg { flightNo: string; carrier: 'El Al';
  from: Airport; to: Airport; departure: string /*ISO+offset*/; arrival: string | 'TBC';
  baggage?: { carryOnKg?: number; checkedKg?: number; trolleyKg?: number }; meal?: boolean }
interface Airport { iata: 'TLV'|'TBS'; name: string; city: string; timeZone: string }
interface Trip { name; resort; hotel; start: string; end: string; travelers: Traveler[]; outbound: FlightLeg; return: FlightLeg }

// packing
type Category = 'clothing' | 'essentials' | 'electronics' | 'ski';
type Ownership = 'need-to-buy' | 'have';
interface PackingItem { id: string; name: string; category: Category; ownership: Ownership; packed: boolean; createdAt: number }
interface PackingState { version: 1; lists: Record<TravelerId, PackingItem[]>; templateOffered: Record<TravelerId, boolean> }
interface PackingRepository { load(): Promise<PackingState>; save(s: PackingState): Promise<void> } // async so a backend fits later

// facts
type FactTopic = 'skiing'|'gudauri'|'resort'|'georgia'|'food'|'beginner';
interface Fact { id: string; topic: FactTopic; text: string; source: string /*URL, not rendered prominently*/ }

// countdown
type TripPhase = { kind:'before'; remainingMs } | { kind:'during'; day: 1..5; total: 5 } | { kind:'after' }
```

## 4. UX / navigation

- Persistent top header (logo + "Home" + page title) on all sizes; **bottom tab bar on mobile** (Home, Flights, Packing, Game, More→Facts/Map/Assistant), side/top nav on desktop. Active state = color + underline + `aria-current="page"`.
- Every page: visible `<h1>`, breadcrumb-like "← Home" link.
- Visual identity: snowy blues + warm Georgian-wine accent, rounded "sticker" style matching avatars, subtle CSS snowfall (off under `prefers-reduced-motion`). Light/dark via tokens.
- Toasts in bottom-left/top-right corner region above tab bar, `role="status"`, never over primary controls; dismiss button; muted setting in Facts page (persisted).

## 5. Feature notes

- **Countdown phases:** `before` = now < outbound departure (`2027-02-24T05:15:00+02:00`). `during` = until return arrival (`2027-03-01T00:35:00+02:00`); "Day X of 5" uses the **Asia/Tbilisi calendar date** (24 Feb = Day 1 … 28 Feb = Day 5, clamped, so 00:00–00:35 on 1 Mar Israel time is still Day 5). `after` = "Welcome home" + trip recap links. Tick with `requestAnimationFrame`/1 s interval aligned to the second; `aria-live` only announces once a minute.
- **Outbound arrival:** stays `TBC` per instructions. Trackers suggest ≈09:05 Tbilisi time but disagree, so it is not used until confirmed.
- **Flights page:** cards per leg, local times formatted in each airport's zone with labels like "05:15 (Israel, UTC+2)", baggage icons, "times shown in local time of each airport" note. No PNR, seats or surnames.
- **Packing:** reducer + selectors (pure, tested). Inline add row (Enter adds, Esc cancels), click/Enter to edit the name in place, Delete key/button with a 5 s undo toast. Filters as chip toggles; progress bar "18/30 packed". Starter template (~35 items across 4 categories) offered once per profile via a banner (Accept / Skip). Export downloads `gudauri-packing-<date>.json`; import validates the shape and version before replacing, after a confirm step. Storage: `safeStorage` wraps get/set in try/catch and falls back to in-memory.
- **Facts:** `facts.ts` with 40+ facts, each written in my own words with a `source` URL. Already verified: altitude ≈1,990–3,279 m, heli-skiing heritage, above the tree line, Jvari Pass 2,379 m, Georgian Military Road, Friendship Monument (1983, neutral wording), 8,000-year wine evidence (PNAS 2017), qvevri UNESCO **intangible** heritage (2013), Georgian scripts UNESCO intangible (2016), khachapuri/khinkali/churchkhela/badrijani, supra/tamada, plus general skiing and beginner tips. Disputed numbers (piste km 35–76, lifts 15–18) are either left out or cited with "according to X". Marco Polo ski-in/out is described as "close to the Pirveli lift" (from booking sites only). Rotation: a shuffle bag (no repeats until all have shown), first toast after 20 s, at most one per 45 s, paused while the tab is hidden and on the Game page, auto-dismiss after 12 s, mute toggle persisted.
- **Avatars:** hand-built SVG in a shared "sticker" style (same head shape, outline weight and eye style) with a parametric `parts.ts` (skin, hair shape and color, eye color). Each traveler gets a `face` and a `ski` pose (with goggles, jacket in their color). `role="img"` + `aria-label="Ofek"`. All four are reviewed together side by side before moving on.
- **Map:** `scripts/fetch-pistes.ts` runs an Overpass query on bbox `42.44,44.40,42.57,44.53` (piste:type=downhill + aerialway). It projects the data to local SVG coordinates, simplifies (Douglas–Peucker) and writes `src/data/pistes.json` (small, committed). An original stylized SVG render (blue/red/black/green difficulty colors, lifts as dashed lines with names) is the blurred background on all pages and a full interactive `#/map` page (tap a run to see its name and difficulty). The footer and map page show "© OpenStreetMap contributors (ODbL), OpenSkiMap.org" with links. Map data is ODbL; the code is MIT. The derived JSON is noted as ODbL in the README.
- **Game:** fixed-timestep update + rAF render, object pools, pre-rendered sprites (avatar ski poses rasterized to an offscreen canvas once), DPR capped at 2, no allocations in the loop. Controls: ←/→ or A/D, touch = hold the left/right half of the screen, P/Esc pauses, auto-pause on blur. Speed ramps with distance. Obstacles: trees, rocks, flags (missing a gate = penalty); collectibles: khachapuri ⭐ and snowflakes. High scores per character in localStorage (top 5). Reduced motion only affects decorative effects.
- **Assistant:** see §6. Chat transcript with avatar bubbles; a mic button only when `SpeechRecognition`/`webkitSpeechRecognition` exists, otherwise a hint plus the text box. TTS toggle (speechSynthesis), language `en-US`. Streams the response if the provider supports it. Errors map to friendly messages (rate-limited, daily quota used up, offline).

## 6. AI provider: comparison and recommendation

|              | **Cloudflare Workers AI** ✅                                                                                                   | Google Gemini free                                                        | Groq free                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------- |
| Free quota   | 10k "Neurons"/day (≈1,300 short turns on Llama 3.1 8B fast, ≈400 on Llama 4 Scout), resets 00:00 UTC, hard-stops (never bills) | Per project, cut back in 2026, unclear (roughly hundreds of requests/day) | ≈30 RPM, ~1k+ RPD per model, TPM is the bottleneck |
| Latency      | ~0.5–2 s                                                                                                                       | ~0.5–1.5 s                                                                | fastest (<0.5 s TTFT)                              |
| Key handling | **No API key at all** (Worker `AI` binding)                                                                                    | Secret `GEMINI_API_KEY`                                                   | Secret `GROQ_API_KEY`                              |
| Gotchas      | Large models use up quota fast                                                                                                 | Free-tier data may be used for training or human review; 18+ ToS          | Org-wide limits; models retired at short notice    |

**Recommendation: Cloudflare Workers AI** via a Worker on `*.workers.dev` (free: 100k req/day). There's no third-party key to leak, no training on your data and one account. Default model `@cf/meta/llama-3.1-8b-instruct-fp8-fast` (snappy for voice), configurable via a `MODEL` var to switch to Llama 4 Scout or another model. Groq stays documented as an optional fallback provider behind the same `/chat` interface.

**Proxy (`/worker`)**: `POST /chat {messages}` → Origin allowlist (`https://ofekfa.github.io`, `http://localhost:5173`); CORS preflight; Cloudflare **rate-limit binding** (e.g. 10 req/60 s per IP) + a per-IP daily cap; max 500 chars per user message, max 10 messages of history, `max_tokens` ≈ 300. The system prompt (built **server-side** from a copy of the public trip data, so clients can't rewrite it) tells the model: answer briefly and in a friendly way, use trip facts, say "I don't know" for live info (weather, lift status). Tested with Vitest + `@cloudflare/vitest-pool-workers` (or plain unit tests of pure handlers). The frontend reads the worker URL from `VITE_ASSISTANT_URL` (not secret, but kept out of code via `.env`; CI gets it from a repo **variable**).

**What you will do manually (Phase 6):** 1) Create a free Cloudflare account. 2) `cd worker && npx wrangler login` (browser OAuth). 3) `npx wrangler deploy` and note the `*.workers.dev` URL. 4) Add it on GitHub as a repo variable `VITE_ASSISTANT_URL` (Settings → Secrets and variables → Actions → Variables). No API key is needed with Workers AI. For the optional Groq fallback, you would run `npx wrangler secret put GROQ_API_KEY` locally and never paste the key into chat.

## 7. Git, CI and deploy

- `gh repo create Ofekfa/gudauri-2027 --public`, default branch `main`. Live URL: **https://ofekfa.github.io/gudauri-2027/** with Vite `base: '/gudauri-2027/'`.
- Feature branches → Conventional Commits → `gh pr create` (description + checklist) → wait for CI green (`gh pr checks --watch`) → `gh pr merge --squash --delete-branch`.
- `ci.yml`: on PR, run Node 22 LTS, `npm ci`, lint, typecheck, test, build (+ worker tests).
- `deploy.yml`: on push to `main`, use the official `actions/configure-pages`, `upload-pages-artifact` and `deploy-pages`. Pages source is set to "GitHub Actions" (`gh api` call).
- Tag `v0.N.0` at the end of each phase. `PLAN.md` (a copy of this plan) is committed in Phase 1 and updated with a status checklist each phase. `CLAUDE.md` documents conventions, commands and architecture.
- Tooling: ESLint flat config (typescript-eslint, eslint-plugin-jsx-a11y), Prettier, Vitest (+ jsdom for component-light tests). `.gitignore` covers `.env*` (except `.env.example`), `.dev.vars` and `.wrangler`.

## 8. Phases and acceptance criteria (stop for feedback after each)

1. **Shell (v0.1.0):** scaffold, tooling, CI, Pages deploy, layout/nav (header + mobile tab bar, active states, hash router, page titles, focus management), `trip.ts`, countdown, flights page, CLAUDE.md, README, PLAN.md. ✔ Live URL loads; refreshing `#/flights` works; countdown matches a fixed-clock test for before/during (Days 1–5 boundaries in the Tbilisi zone)/after; flight times show 05:15 TLV and 23:55 TBS regardless of system TZ (tests run under `TZ=America/New_York` too); CI green.
2. **Identity (v0.2.0):** design tokens, light/dark, 4 avatars (face + ski), Overpass extract + SVG map background + `#/map` page with attribution, snow effect. ✔ Contrast AA on all text over the map; reduced motion disables snow; avatars have labels.
3. **Packing (v0.3.0):** ✔ Full CRUD by keyboard only; filters + progress; template accept/skip; export→import round trip; works with storage disabled (in-memory); reducer/selector tests.
4. **Facts (v0.4.0):** ✔ ≥40 sourced facts across 6 topics; toasts rate-limited (tested with fake timers), dismissible, never over the tab bar or primary buttons, muted setting persists; facts list page with topic filter.
5. **Game (v0.5.0):** ✔ Keyboard and touch; pause/restart; per-character high scores; holds ~60 fps on a mid-range phone (verified with a Chrome performance trace + CPU 4× throttle); chunk lazy-loaded.
6. **Assistant (v0.6.0):** worker + chat UI. ✔ Answers "when do we land back home?" correctly; a disallowed origin gets 403; too-long input gets 413; the rate limit returns 429 → friendly UI message; Firefox gets the text-only fallback; no key anywhere in the repo or bundle (grep check).
7. **Polish (v1.0.0):** ✔ Lighthouse mobile ≥90 performance and ≥95 accessibility, keyboard-only walkthrough, axe check, iOS Safari + Android Chrome QA (via Chrome device emulation + your phone), 404.html redirect, OG image.

## 9. Risks and open issues

- **Outbound arrival time** unknown → `TBC` in the config (trackers say ≈09:05 but disagree).
- **Disputed resort stats** (piste km, lift count) → cite a source or leave out.
- **OSM coverage** of Gudauri may be incomplete or have unnamed runs → the map shows what exists and labels unnamed runs by difficulty only. The bbox gets checked in Overpass Turbo during Phase 2.
- **Workers AI quota** (10k Neurons/day) is enough for 4 people; the UI handles the quota-exhausted case. Origin checks can be spoofed by non-browser clients → rate limits are the real protection.
- **Web Speech** recognition is missing or limited in Firefox and some Safari setups → text fallback; iOS needs a user gesture before TTS.
- **Avatar quality** is subjective → review checkpoint at the end of Phase 2.
- **Privacy:** first names only; the public flight info stays public; repo and bundle grepped before each release.

## Verification (each phase)

`npm run lint && npm run typecheck && npm run test && npm run build` locally and in CI → merge → watch the deploy workflow → load the live URL in Chrome (claude-in-chrome) at mobile and desktop widths, check for console errors and deep-link refresh → report the URL + 3–5 bullets → stop.
