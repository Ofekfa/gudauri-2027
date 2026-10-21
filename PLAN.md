# PLAN — Gudauri 2027

## Status

| Phase | Scope                                                                    | Status  | Tag    |
| ----- | ------------------------------------------------------------------------ | ------- | ------ |
| 1     | Scaffold, tooling, CI, Pages, nav shell, trip config, countdown, flights | ✅ Done | v0.1.0 |
| 2     | Avatars, map background, visual identity                                 | ✅ Done | v0.2.0 |
| 3     | Packing list                                                             | ✅ Done | v0.3.0 |
| 4     | Fun facts + pop-ups                                                      | ✅ Done | v0.4.0 |
| 5     | Skiing game                                                              | ✅ Done | v0.5.0 |
| 6     | Voice AI assistant + Worker proxy                                        | ✅ Done | v0.6.0 |
| 7     | Polish: a11y, perf, mobile QA                                            | ✅ Done | v1.0.0 |
| 8.0   | Round 2 foundations (nav, Worker router + CI deploy, list toolkit…)      | ✅ Done | v1.1.0 |
| 8.1   | Georgian words                                                           | ✅ Done | v1.2.0 |
| 8.2   | Currency converter                                                       | ✅ Done | v1.3.0 |
| 8.3   | Pre-flight to-do list                                                    | ✅ Done | v1.4.0 |
| 8.4   | Itinerary (Google Calendar)                                              | ⏳ Next | v1.5.0 |
| 8.5   | Weather, snow & webcams                                                  | —       | v1.6.0 |
| 8.6   | Assistant live context + polish                                          | —       | v1.7.0 |
| 8.7   | Offline mode (service worker) + baked fallback rate                      | —       | v1.8.0 |

**Live:** https://ofekfa.github.io/gudauri-2027/

### Deviations from the original plan

- Phase 1: the router is in-house (`src/lib/router/hashRouter.ts`). Route metadata lives in `src/navigation.ts`, and the "More" tab is a page (`#/more`) rather than a pop-up sheet, which is simpler to navigate on phones.
- Phase 1: ESLint is pinned to v9 because `eslint-plugin-jsx-a11y` doesn't support v10 yet.
- Phase 2: map data comes straight from Overpass (OpenStreetMap). OpenSkiMap's worldwide GeoJSON is too large to clip for one resort, so it's credited and linked instead. 50 runs, 16 lifts, the hotel, the Friendship Monument and 6 peaks; regenerate with `npm run fetch:pistes`.
- Phase 2: eye colors not given in the brief were chosen (Ron, Roy: brown) and can be edited in `src/data/characters.ts`. Maya was later changed to brown eyes and glasses (see below). Skier pose uses a "pizza" wedge.
- Phase 2: the map page doesn't use pinch-zoom; zoom buttons (100–300%) plus native scrolling keep it simple and accessible. Phones open at 200%.
- Between phases 2 and 3: avatar tweaks per feedback (Maya brown eyes + glasses, Roy undercut, Ofek warmer skin), tagged as part of v0.3.0.
- Phase 3: a generic toast system (`src/lib/toast`) landed early because undo-delete needs it; Phase 4 fact pop-ups reuse it. Import confirmation is inline rather than a browser dialog. The starter template marks everything "Already have" by default.
- Phase 4: 55 facts (target 40+). A fact-check pass corrected the Kobi gondola year (2019), Khachapuri Index start (2011), speed-skiing record (255.5 km/h, 2023) and Military Road details. Unsupported details were dropped. Pop-ups are also paused on the Facts page, and the fact data loads lazily.
- Between phases 4 and 5: the Fun facts page became a one-at-a-time viewer (← → keys, swipe, Previous/Next) per feedback.
- Phase 5: the flags are obstacles (no slalom gates). The game is 60 fps in Chrome, with < 0.1 ms of JS per frame at p99. A CPU-throttled check was done in Phase 7 with 4× CPU throttling (60 fps, p95 16.8 ms). Testing on real phones is still open.
- Phase 6: the Worker is live at `https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev` (model `@cf/meta/llama-3.1-8b-instruct-fp8`). The site gets the URL from the repo variable `VITE_ASSISTANT_URL`. No per-IP daily cap: the free rate-limit binding only supports 10 s/60 s windows and is approximate (eventually consistent across Cloudflare locations; in testing a burst got 429s only after ~75 requests). The Workers AI free daily allowance is the hard cap.
- Phase 7 results (live site, Lighthouse mobile): performance 98–100, accessibility/best practices/SEO 100 on all 7 pages. FCP ≈ 1 s and CLS 0, after self-hosting the font (render-blocking Google Fonts removed) and fixing lazy-page layout shift. A headless axe sweep (2 phone sizes × light/dark + interactive states) is at 0 violations after fixing two findings. No horizontal overflow at 375/412/1280 px. Game at 4× CPU throttle: 60 fps, p95 16.8 ms. Added a link-preview image and an iOS home-screen icon. **Still open:** a hands-on check on real phones (iOS Safari speech input/read-aloud, Android Chrome), which needs physical devices.

- Phase 8.0: the CI and live checks showed `/health` and `/chat` unchanged after the Worker refactor. Worker CI deploys are wired up but **skip until Ofek adds the `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets**. The `CACHE` KV namespace is created when the first data route lands (8.2).

- Phase 8.0 follow-up: Ofek added the Cloudflare secrets, and a manual run of the Worker deploy workflow succeeded with the minimal token (Workers Scripts: Edit + Workers KV Storage: Edit). Worker deploys are now automatic.
- Phase 8.1: 27 words (target 20+) in `src/data/words.ts`, each with its own Wiktionary page. ანგარიში is glossed "account" on Wiktionary, so it's presented as "the bill (literally 'account')". No Georgian TTS voice was found on the test machine, so the "Hear it" button stays hidden there, by design. Georgian text uses system fonts via `:lang(ka)`; real-device rendering is on Ofek's checklist.

- Phase 8.2: KV namespace `CACHE` created with Ofek's approval (id in `worker/wrangler.toml`). `/rates` serves official NBG rates (12 h TTL, 7-day stale), with an ExchangeRate-API fallback. Friendly rounding was tuned to 1s below 50 (so ₾20 ≈ ₪24, not ₪25). The selects use short labels (₪ ILS / ₾ GEL / € EUR) to fit 375 px. The site has no offline mode (no service worker), so "offline" means the page loaded but the rates request failed; cached rates then show with a notice.

- Phase 8.3: the to-do list has five lists (four travelers + Shared). Day-based deadlines are the **end of that day in Israel time**, and check-ins are exact (departure − 3 h, shown in Israel time; LY5110's appears as 18:55 Israel = 20:55 Tbilisi). The El Al check-in window stays unverified and is worded as "usually ~24 h; confirm in the El Al app". The passport item points to Georgia's current entry rules rather than stating a validity requirement. The Home card reads storage synchronously so it never shifts the layout. Testing lesson: tap UI by DOM `click()` in headless tests (the fixed tab bar intercepts coordinate taps at 375 px), and wait for colour transitions before axe contrast checks.

### Content Security Policy decision (Round 2, Phase 8.0)

**No CSP for now.** Reasons:

- GitHub Pages can't send response headers, so a CSP would have to be a `<meta>` tag, and `frame-ancestors`/`report-uri` don't work that way.
- Round 2 adds new origins (the Worker and `youtube-nocookie.com` webcam embeds), which would have to be kept in sync in two places.
- The site loads no third-party scripts or styles, and all user and calendar content is rendered as text, never HTML.

Revisit once the webcam and API origins are stable (after Phase 8.5). The candidate policy would be `default-src 'self'; connect-src 'self' <worker>; frame-src https://www.youtube-nocookie.com; img-src 'self' data:`.

---

## Context

A public, mobile-first companion site for a 4-person ski trip (Ofek, Ron, Roy, Maya) to Gudauri, Georgia, 24–28 Feb 2027. Empty project directory; greenfield. Hosted on GitHub Pages (static) with a tiny serverless proxy for a free AI model.

**Decisions (confirmed):** English (LTR) · repo `gudauri-2027` (public) · packing lists per-device (localStorage behind a swappable interface + JSON export/import) · Preact + TypeScript.

Env: Node 24.8, npm 11.6, git 2.39, gh authenticated.

---

## 1. Architecture

- **Vite + Preact + TS** (`@preact/preset-vite`). Runtime deps: `preact` only, with an in-house hash router.
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
- **Outbound arrival:** confirmed as 09:50 Tbilisi time (UTC+4), a 2h 35m flight. Both tickets have the same baggage allowance.
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

**Recommendation: Cloudflare Workers AI** via a Worker on `*.workers.dev` (free: 100k req/day). There's no third-party key to leak, no training on your data and one account. Default model `@cf/meta/llama-3.1-8b-instruct-fp8-fast` (snappy for voice), configurable via a `MODEL` var to switch to Llama 4 Scout or another model. _(Superseded: the Groq fallback was never implemented, and the model in use is `@cf/meta/llama-3.1-8b-instruct-fp8`.)_

**Proxy (`/worker`)**: `POST /chat {messages}` → Origin allowlist (`https://ofekfa.github.io`, `http://localhost:5173`); CORS preflight; Cloudflare **rate-limit binding** (10 req/60 s per IP; the planned per-IP daily cap was dropped, see Deviations); max 500 chars per user message, max 10 messages of history, `max_tokens` ≈ 300. The system prompt (built **server-side** from a copy of the public trip data, so clients can't rewrite it) tells the model: answer briefly and in a friendly way, use trip facts, say "I don't know" for live info (weather, lift status). Tested with Vitest + `@cloudflare/vitest-pool-workers` (or plain unit tests of pure handlers). The frontend reads the worker URL from `VITE_ASSISTANT_URL` (not secret, but kept out of code via `.env`; CI gets it from a repo **variable**).

**What you will do manually (Phase 6):** 1) Create a free Cloudflare account. 2) `cd worker && npx wrangler login` (browser OAuth). 3) `npx wrangler deploy` and note the `*.workers.dev` URL. 4) Add it on GitHub as a repo variable `VITE_ASSISTANT_URL` (Settings → Secrets and variables → Actions → Variables). No API key is needed with Workers AI.

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

- ~~Outbound arrival time unknown~~ → resolved: 09:50 Tbilisi time.
- **Disputed resort stats** (piste km, lift count) → cite a source or leave out.
- **OSM coverage** of Gudauri may be incomplete or have unnamed runs → the map shows what exists and labels unnamed runs by difficulty only. The bbox gets checked in Overpass Turbo during Phase 2.
- **Workers AI quota** (10k Neurons/day) is enough for 4 people; the UI handles the quota-exhausted case. Origin checks can be spoofed by non-browser clients → rate limits are the real protection.
- **Web Speech** recognition is missing or limited in Firefox and some Safari setups → text fallback; iOS needs a user gesture before TTS.
- **Avatar quality** is subjective → review checkpoint at the end of Phase 2.
- **Privacy:** first names only; the public flight info stays public; repo and bundle grepped before each release.

## Verification (each phase)

`npm run lint && npm run typecheck && npm run test && npm run build` locally and in CI → merge → watch the deploy workflow → load the live URL in Chrome (claude-in-chrome) at mobile and desktop widths, check for console errors and deep-link refresh → report the URL + 3–5 bullets → stop.

---

# Round 2

## Round 2 plan (Phases 8.0–8.6)

### Context

v1.0.0 is live with countdown, flights, packing, facts, map, game and assistant. Ofek wants five more features: Georgian words, a currency converter, a pre-flight to-do list, an itinerary from the Google Calendar "גיאורגיה", and weather/snow/webcams. They're preceded by foundations (Phase 8.0) that `docs/CODEBASE_REPORT.md` §10 identified.

The code was re-checked against the report (`main` @ `b7cb618`) and matches. Notable: the Worker uses TypeScript 7 and the site TypeScript 6; the desktop nav renders every section; the Worker is deployed by hand.

All `CLAUDE.md` conventions stay in force. Every phase:

- small PRs, squash-merged after green CI;
- a `PLAN.md` status PR, an annotated tag, and an update to `docs/CODEBASE_REPORT.md`;
- deploy, verify the live site, report the URL + 3–5 bullets, and **stop** for feedback.

**This whole plan is appended to `PLAN.md` as "Round 2" in the first PR of 8.0.** The same PR commits `docs/CODEBASE_REPORT.md`.

### Decisions confirmed with Ofek

| Topic            | Decision                                                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile tab bar   | **Home · Itinerary · Packing · Weather · More**. Flights, To-do, Currency, Game, Facts, Map and Assistant go under More.                                                                                                                                                     |
| Desktop nav      | **The same items as mobile + More.** No dropdown.                                                                                                                                                                                                                            |
| More page        | Grouped into **Plan** (Flights, To-do), **Tools** (Currency, Map, Assistant) and **Fun** (Facts, Game).                                                                                                                                                                      |
| To-do scope      | **Personal lists + a "Shared" list** for group tasks. Still per-device.                                                                                                                                                                                                      |
| Itinerary source | **Worker + secret iCal URL** (Worker secret `CALENDAR_ICS_URL`). Only whitelisted fields are returned.                                                                                                                                                                       |
| Weather zones    | **Base 2,000 m** Marco Polo / Pirveli bottom (42.4613, 44.4842; DEM 1,998 m). **Mid 2,700 m** Goodaura gondola top hub (42.4924, 44.4943; DEM 2,702 m). **Top 2,950 m** Kudebi chair top (42.4970, 44.5075; DEM 2,951 m). Elevations come from the Open-Meteo Elevation API. |
| Webcams          | **Tap-to-load embeds** via `youtube-nocookie.com` (a placeholder card until tapped) + an "Open on YouTube" link. There is no Marco Polo cam, so base gets an honest "No webcam at the hotel; nearest live cam: Soliko" note.                                                 |
| CSP              | **Not added this round.** Reasoning is recorded in `PLAN.md` (see 8.0 §8).                                                                                                                                                                                                   |

### Verified external sources (research 2026-10-22)

| Need           | Source                                                                                                                                                       | Facts / terms                                                                                                                                                                                                                                                                                                                             | Caveats                                                                                                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GEL rates      | **National Bank of Georgia**: `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/`, unfiltered (the `currencies=` filter accepts only one code) | Fields `code, quantity, rate, diff, date, validFromDate`. ILS `quantity` is **10** (rate 8.3994 = GEL per 10 ILS), EUR quantity is 1. Published about 21:00 Tbilisi time and valid from the next day; the Friday rate carries over the weekend. CORS echoes Origin.                                                                       | The terms only call the rate "indicative"; there's no published reuse licence. Credit "Official rates: National Bank of Georgia".                                                                                                                                                                               |
| Rates fallback | **open.er-api.com** `/v6/latest/GEL`                                                                                                                         | Includes ILS and EUR, no key, updated daily. **Attribution to ExchangeRate-API is required.**                                                                                                                                                                                                                                             | Used only if NBG fails and there's no cached value.                                                                                                                                                                                                                                                             |
| Weather        | **Open-Meteo** `api.open-meteo.com/v1/forecast`                                                                                                              | Several coordinates and `elevation=` values in one call (statistical downscaling). Variables: `current=temperature_2m,wind_speed_10m,weather_code`; `daily=temperature_2m_max,temperature_2m_min,snowfall_sum,wind_speed_10m_max,weather_code`; `hourly=snow_depth` (m); `past_days` ≤ 92, `forecast_days` ≤ 16, `timezone=Asia/Tbilisi`. | **Non-commercial use only**, under 10k calls/day. **CC BY 4.0**: credit "Weather data by Open-Meteo.com" with a link. All zones snap to the same grid cells (about 3–8 km away), so only the elevation downscaling separates them. Snow depth is **modeled** and the models disagree a lot.                     |
| Webcams        | YouTube live streams by Vitamin Cafe Gudauri: **Soliko** `vBVWcSjPAZM`, **Kudebi** `aCHJ-r15RLM` (Kudebi needs a playback test)                              | The `youtube.com/embed/<id>` iframe is allowed (no X-Frame-Options).                                                                                                                                                                                                                                                                      | Stream IDs change when a broadcast restarts, so they're stored in `src/data/zones.ts` with a "last checked" date. The official gudauri.travel HLS stream didn't respond and would need hls.js, so it's skipped. Marco Polo's site is SAMEORIGIN and has no cam. skiresort.com is used only as an outbound link. |
| iCal parsing   | **ical.js 2.2.1** (Mozilla, ESM, zero deps, about 78 KB minified, ≈25 KB gzipped, estimated)                                                                 | Handles RRULE, EXDATE, RECURRENCE-ID and VTIMEZONE. Worker-only; **not a site dependency**.                                                                                                                                                                                                                                               | The feed holds the calendar's whole history, so blocks are pre-filtered before parsing to stay within the 10 ms CPU limit.                                                                                                                                                                                      |
| Georgian words | Wiktionary, one URL per word (`https://en.wiktionary.org/wiki/<word>`)                                                                                       | Romanization uses the national 2002 system.                                                                                                                                                                                                                                                                                               | —                                                                                                                                                                                                                                                                                                               |
| Georgian font  | System fonts: iOS/macOS Helvetica/Helvetica Neue, Windows Segoe UI/Calibri/Sylfaen, Android Noto Sans Georgian (W3C Georgian gap analysis)                   | No download needed.                                                                                                                                                                                                                                                                                                                       | To be checked on real devices by Ofek.                                                                                                                                                                                                                                                                          |
| Georgian TTS   | No `ka` voice found on iOS, macOS, Android Chrome or Windows; maybe on Edge with online voices                                                               | The speak button stays hidden unless `getVoices()` reports a `ka*` voice.                                                                                                                                                                                                                                                                 | —                                                                                                                                                                                                                                                                                                               |
| CI deploy      | `cloudflare/wrangler-action@v4` (v4.1.3) with `apiToken` + `accountId`                                                                                       | —                                                                                                                                                                                                                                                                                                                                         | —                                                                                                                                                                                                                                                                                                               |
| El Al check-in | **Unverified.** elal.com blocks automated access. Commonly cited as 24 h–3 h before departure; LY5xxx may be operated by Sun d'Or.                           | Due dates are derived from `trip.ts`. The item note says "check-in usually opens ~24 h before; confirm in the El Al app".                                                                                                                                                                                                                 | —                                                                                                                                                                                                                                                                                                               |

---

### Phase 8.0 — Foundations → `v1.1.0`

Planned PRs:

1. `docs/round-2-plan`
2. `feat/nav-scaling`
3. `refactor/worker-router`
4. `ci/worker-deploy`
5. `refactor/list-toolkit`
6. `feat/storage-migrate`
7. `refactor/fact-union`
8. `chore/housekeeping`
9. `docs/phase-8.0-status`

**1. Navigation scaling**

- `src/navigation.ts`:
  - Add `group: 'plan' | 'tools' | 'fun'` to `NavItem`.
  - Add `GROUP_LABEL`.
  - `TAB_BAR_ITEMS` is still derived from `inTabBar`.
  - Add `MORE_GROUPS` (grouped `MORE_ITEMS`).
- In 8.0 the tabs stay Home · Flights · Packing · Game · More. Itinerary and Weather replace Flights and Game in 8.4/8.5, when those pages exist, so there are never "coming soon" tabs.
- `Header.tsx` renders `TAB_BAR_ITEMS` (the same items as mobile), with More active for More sections via `activeTabPath`.
- `MorePage.tsx` renders one `<section><h2>` per group with `SectionCards`.
- Tests (`navigation.test.ts`):
  - exactly 5 tab items, Home first and More last;
  - every non-tab section has a group;
  - header items = tab items;
  - `activeTabPath` maps More sections.

**2. Worker refactor** (behaviour of `/health` and `/chat` stays identical; existing 11 tests stay green)

- `worker/src/http.ts`: `json()`, `errorJson()`.
- `worker/src/cors.ts`: allowlist + preflight.
- `worker/src/router.ts`: the route table:
  ```ts
  interface Route {
    method: 'GET' | 'POST';
    path: string;
    rateLimit?: keyof RateLimitBindings;
    handler(ctx): Promise<Response>;
  }
  ```
  Shared pipeline: origin → OPTIONS → method → rate limit (per-IP, per-route binding) → handler.
- `worker/src/cache.ts`:
  ```ts
  getOrRefresh<T>(store: CacheStore, key, { ttlMs, maxStaleMs }, fetcher: () => Promise<T>, validate: (u: unknown) => T): Promise<{ data: T; fetchedAt: number; stale: boolean }>
  ```
  - **CacheStore** has two implementations:
    - **KV** (`CACHE` binding): primary. The Cache API is documented as having no effect on `*.workers.dev`; this gets verified first.
    - In-isolate memory: a micro-cache layered on top.
  - Stale-on-error: serve the last good value up to `maxStaleMs` and mark it `stale: true`.
  - Budget: about 150 KV writes/day in total, within the 1k free tier (to verify).
- `wrangler.toml`:
  - Add a `CACHE` kv namespace.
  - Add rate limiter `RL_DATA` (60 req/60 s); keep `RATE_LIMITER` for chat.
- `worker/src/routes/{health,chat}.ts`.
- Tests:
  - the router (404, 405, 403, OPTIONS, per-route limit);
  - the cache: fresh, expired + refetch, upstream error → stale, too stale → 502;
  - validation reject.
- No new routes yet.

**3. Worker CI deploy**

- New `.github/workflows/worker-deploy.yml`:
  - Triggers: `push` to `main` with paths `worker/**`, `src/data/**`, `src/lib/facts/types.ts`, plus later `src/lib/weather/**` and `src/lib/itinerary/**`; also `workflow_dispatch`.
  - Steps: `npm ci`, typecheck and test in `worker/`, then `cloudflare/wrangler-action@v4` with `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}` and `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`, `workingDirectory: worker`.
- The job is skipped with a clear message if the secrets are missing.

**4. Generic list toolkit** (packing behaves exactly as before, with no stored-data change)

- `src/lib/list/ids.ts`: `defaultIdGenerator`, `IdGenerator`.
- `src/lib/list/text.ts`: `normalizeName(name, max)`. Packing re-exports from `lib/list` with its 80-character limit.
- `src/components/common/ProfileSwitcher.tsx`, moved from `packing/`:
  - new props `profiles?: { id, label, avatar }[]`, so the Shared profile (a group icon, no avatar) works;
  - `ariaLabel` prop;
  - defaults keep the current markup.
- `src/components/common/ProgressSummary.tsx`:
  - props `title`, `done`, `total`, `badge?`, `ariaLabel`;
  - extracted from the inline `PackingPage` markup, keeping its classes.
- `src/components/common/BackupPanel.tsx`:
  - props `appLabel`, `fileStem`, `serialize(now)`, `parse(text) => ParseResult<T>`, `onImport(T)`, `replaceWarning`;
  - the packing page passes its existing functions.
- Tests: the existing packing tests stay green, plus `lib/list` tests.

**5. Storage migration helper**

- `src/lib/storage/versioned.ts`:
  ```ts
  loadVersioned<T>(store, key, { version, migrations: Record<number,(old)=>unknown>, validate(raw): T | null, empty(): T }): T
  saveVersioned(store, key, version, data)
  ```
- The packing repository adopts it **without changing its format**. Packing stores `{version:1,…}` inline, so the helper supports an "inline version field" mode.
- New stores (`todo`, `currency:rates`) use the same mode.
- Tests: missing data, corrupt data, current version, a migration chain, and a future version (keeps empty without overwriting).

**6. Fact type → discriminated union**

- In `src/lib/facts/types.ts`:
  ```ts
  type Fact = BaseFact & ({ topic: Exclude<FactTopic, 'words'> } | WordFact);
  ```
  `WordFact` is introduced in 8.1. In 8.0 the union is in place with the current topics, and `text` keeps all consumers unchanged.
- Add a type-level test (an assignment check) plus the existing facts tests.

**7. Housekeeping**

- Fix the stale lines from report §10.8 in `PLAN.md` and `CLAUDE.md`.
- `worker/package.json`: pin `typescript` to `^6.0.3` to match the site (aligned on the version the site is proven with). Re-run the Worker typecheck and tests.
- Remove the unused `jsdom`.

**8. CSP decision** (recorded in `PLAN.md`)

- No CSP this round:
  - GitHub Pages can only use a `<meta>` CSP, and `frame-ancestors` can't be set that way.
  - New origins (Worker, YouTube embeds) would need to be maintained in two places.
  - The site loads no third-party scripts, and user content is rendered as text.
- Revisit once webcam origins are stable.

**Acceptance criteria**

- The desktop header shows 5 items at any width ≥ 56rem, with no wrap at 900–1,440 px.
- The More page is grouped.
- All site tests and Worker tests pass.
- `/health` and `/chat` behave as before on the live Worker (curl check: 200 reply, 403, 413).
- The Worker deploys from CI after the secrets are added.
- Packing works exactly as before.
- Lighthouse and axe stay at the current bar.

**Manual steps for Ofek**

1. **Cloudflare API token:**
   - Dashboard → profile icon → **My Profile → API Tokens → Create Token → Create Custom Token**.
   - Name: `gudauri-worker-deploy`.
   - Permissions: **Account → Workers Scripts → Edit** and **Account → Workers KV Storage → Edit** (needed for the KV binding).
   - Account Resources: Include → your account. TTL: optional.
   - Continue → Create, then copy the token once.
   - If the first deploy fails with an authentication error, add **Account → Account Settings → Read** and **User → Memberships → Read**. That's documented as possibly needed and gets confirmed on the first run.
2. **Account ID:** Dashboard → Workers & Pages → right sidebar "Account ID".
3. **GitHub:** repo → Settings → Secrets and variables → Actions → **New repository secret**: add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Or from your own terminal: `gh secret set CLOUDFLARE_API_TOKEN`, which prompts and keeps the token out of chat.
4. **KV namespace:** I create it with your existing wrangler login (`npx wrangler kv namespace create CACHE`), asking first. Its id is not secret and goes in `wrangler.toml`.

---

### Phase 8.1 — Georgian words → `v1.2.0`

- **Types:**
  ```ts
  WordFact { topic: 'words'; word: string /* Mkhedruli */; transliteration: string /* national system */; meaning: string; pronunciation?: string }
  ```
  - `FACT_TOPICS` gains `'words'`; label "Georgian words", emoji 🗣️.
- **Data:** at least 22 entries in `src/data/facts.ts` (or `src/data/words.ts` concatenated into `FACTS`), each with its Wiktionary https source:

| Group           | Words                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Greetings       | gamarjoba / gagimarjos, nakhvamdis, dila mshvidobisa                                                                  |
| Thanks          | madloba, didi madloba                                                                                                 |
| Yes / no        | diakh (formal) / k'i (casual), ara                                                                                    |
| Please / sorry  | tu sheidzleba, gtkhovt, bodishi                                                                                       |
| Toast           | gaumarjos                                                                                                             |
| Shopping & food | ra ghirs?, angarishi (with a note: "the bill, please" = angarishi, tu sheidzleba), ts'q'ali, ghvino, p'uri, gemrielia |
| Emergency       | mishvelet!                                                                                                            |
| Numbers         | erti, ori, sami, otkhi, khuti                                                                                         |
| Mountain        | tovli, mta                                                                                                            |

- Pronunciation tips for kh, gh, ts', q', p', k'.
- `text` = "„გამარჯობა" (gamarjoba) means "hello"…" so pop-ups and the assistant work unchanged.
- **UI:**
  - `FactsPage` renders a `WordCard` for `topic === 'words'`: large `<span lang="ka">` Mkhedruli, transliteration, meaning, tip and source.
  - Add a "Words" chip; it's a topic chip, so it comes for free.
- **Pop-ups:** words appear in the rotation (title = the meaning).
- **Font:**
  ```css
  :lang(ka) {
    font-family:
      'Noto Sans Georgian', 'Helvetica Neue', Helvetica, 'Segoe UI', Calibri, Sylfaen, sans-serif;
  }
  ```
  No download. Verified with a Chrome render check plus a canvas glyph-width check that Mkhedruli isn't rendered as tofu. iOS, Android and Windows go on Ofek's device checklist.
- **TTS:**
  - `src/lib/speech/voices.ts` provides `findVoice(prefix)`, re-checked on `voiceschanged`.
  - The 🔊 button renders only when a `ka*` voice exists. It is never faked.
- **Tests:**
  - every word has `word`, `transliteration`, `meaning` and a `wiktionary.org` https source;
  - `word` contains Georgian Unicode only (U+10D0–U+10FF plus spaces and punctuation);
  - at least 20 words;
  - `findVoice` with a mocked voice list.
- The Worker redeploys automatically through the CI job; checked with a `/chat` "How do I say thank you in Georgian?".
- **Acceptance:**
  - the Words chip shows the cards with `lang="ka"`;
  - axe passes;
  - no TTS button without a voice;
  - the live assistant answers with "madloba".

### Phase 8.2 — Currency converter → `v1.3.0`

- **Worker `GET /rates`**
  - Uses `RL_DATA`. TTL **12 h**, `maxStale` 7 days.
  - Fetches NBG unfiltered, takes ILS and EUR, and normalizes per unit (`rate / quantity`). Validation: finite numbers within sane bounds (ILS 0.3–3 GEL, EUR 1–10 GEL).
  - Fallback: open.er-api.com, with `source` set accordingly.
  - Payload:
    ```json
    { "base":"GEL", "gelPer": { "ILS": 0.83994, "EUR": 2.9163 }, "validFrom":"2026-10-22", "source":"nbg"|"er-api", "fetchedAt":"<ISO>", "stale":false }
    ```
- **`src/lib/currency/`** (pure)
  - `convert(amount, from, to, gelPer)` pivots through GEL.
  - `roundForDisplay`: GEL/EUR 2 decimals, ILS 2 decimals.
  - `friendlyRound`: ≈ nearest 1 under 20, nearest 5 under 200, nearest 10 above.
  - `quickTable`:
    - GEL rows 5, 10, 20, 50, 85, 100, 125, 200 → ≈ ILS;
    - reverse ILS rows 10, 20, 50, 100, 200, 500 → ≈ GEL.
  - `parseAmount` accepts "1,5"/"1.5" and rejects negatives.
  - `ratesRepository` uses `loadVersioned` with key `currency:rates` (v1) and keeps the last payload.
- **`CurrencyPage`** (lazy, in More/Tools)
  - Amount input (`inputmode="decimal"`, label), from/to `<select>`s, an accessible swap button, and a live result (`aria-live="polite"`).
  - Both tables.
  - "Rates as of {validFrom} (NBG official)" plus a stale/offline badge.
  - Note: "Card, ATM and exchange-booth rates differ from official rates."
  - Credit for the source.
  - FactPopups **blocked** on `/currency` (an input-heavy page).
- **Icon:** `coins`.
- **Tests:**
  - lib: conversions, rounding, table values;
  - sanity check against the mental model at an ILS rate of 0.84: 10 GEL → ≈12 ILS, 50 → ≈60, 85 → ≈100, 125 → ≈150;
  - Worker: NBG success, NBG down → fallback, both down → stale, garbage payload rejected, quantity normalization.
- **Acceptance:**
  - the live page shows today's NBG rate and date;
  - the tables match the mental model;
  - it works offline from cache;
  - Lighthouse and axe pass.

### Phase 8.3 — Pre-flight to-do list → `v1.4.0`

- **`src/lib/todo/`**
  - `model.ts`:
    ```ts
    type TodoListId = TravelerId | 'shared';
    TODO_CATEGORIES = ['documents','connectivity','flight','gear','ski'];  // labels: Documents & insurance / Connectivity / Flight / Gear / Ski
    TodoItem { id; title; note?; done; dueBy?: string /* ISO with offset */; category; templateKey?: string; createdAt }
    TodoState { version: 1; lists: Record<TodoListId, TodoItem[]>; templateDecided: Record<TodoListId, boolean> }
    ```
  - `reducer.ts`: add, edit (title/note/category/dueBy), toggleDone, remove, restore, applyTemplate, skipTemplate, replaceAll.
  - `selectors.ts`: `filterTodos`, `progress`, `nextDue(items, now, n)`.
  - `importExport.ts`.
  - `repository.ts`: key `todo`, via `loadVersioned`.
  - `useTodo.ts`.
- **`src/data/todoTemplate.ts`:** due dates are computed from `trip.ts`; nothing is hard-coded.

  | List     | Items                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
  | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Personal | Travel insurance incl. winter sports / skiing cover (due D−14) · eSIM or roaming package (D−3) · **Online check-in LY5107** (due `outbound.departure − 3 h`; note: "Usually opens ~24 h before; confirm in the El Al app") · **Online check-in LY5110** (due `inbound.departure − 3 h`) · Check passport validity (D−30; requirement to be verified against Georgia's entry rules during implementation) · Order missing gear (`templateKey: 'missing-gear'`, D−10) · Get some GEL cash (D−1) |
  | Shared   | Book the Tbilisi → Gudauri transfer (D−7) · Book ski/snowboard rental (D−7) · Research/book ski instructors (D−10)                                                                                                                                                                                                                                                                                                                                                                            |

- **`TodoPage`** (lazy, More/Plan)
  - `ProfileSwitcher` with the four travelers + "Shared" (group icon).
  - `ProgressSummary`.
  - Add form, rows with an optional note and an optional due date (date input, interpreted in Israel time).
  - Category filter, `BackupPanel`, `TemplateOffer` (shared or generalized), a per-device note.
  - FactPopups blocked on `/todo`.
- **Due display:** `formatInZone(dueBy, 'Asia/Jerusalem')` + "in 3 days / overdue".
- **Packing integration:**
  - The `missing-gear` row shows "N items marked need to buy", read through `defaultPackingRepository.load()` and `progress().needToBuy`.
  - It links to `#/packing?status=need-to-buy&who=<id>`.
  - `hashRouter` gains `parseHashQuery()` (tested); `PackingPage` reads its initial status filter and profile from the query.
- **Home (before phase):** a "Next to-dos" card with up to 3 undone items, nearest due first, from the last-selected profile (`todo:profile`) plus Shared, linking to `#/todo`.
- **Tests:**
  - reducer, selectors, `nextDue`, import/export, repository;
  - template due dates derived correctly from the trip ISO strings (also run under `TZ=America/Los_Angeles`);
  - `parseHashQuery`.
- **Acceptance:**
  - template offered once per list;
  - the live count matches packing;
  - the Home card shows the next items;
  - export/import round-trips.

### Phase 8.4 — Itinerary → `v1.5.0`

- **Worker `GET /itinerary`**
  - Uses `RL_DATA`. TTL **20 min**, `maxStale` 7 days.
  - Fetches `env.CALENDAR_ICS_URL`, never logged and never echoed in errors.
  - **Pre-filter** VEVENT blocks by text: keep a block if it has an RRULE, or if its DTSTART/DTEND falls within 2027-02-23…2027-03-01 ± 1 day. Then parse with **ical.js**:
    - register VTIMEZONEs;
    - expand RRULE/EXDATE/RECURRENCE-ID within the window.
  - **Whitelist output** (description, attendees, organizer, URL and emails are dropped):
    ```json
    { "timeZone":"Asia/Tbilisi", "range":{ "from":"2027-02-23", "to":"2027-03-01" },
      "events":[{ "id":"<hash of UID+start>", "title":"…", "start":"2027-02-24T13:00:00+04:00" | "2027-02-24",
                  "end":"…", "allDay":false, "location":"…" }],
      "fetchedAt":"<ISO>", "stale":false }
    ```
  - Titles/locations are truncated (120/120 characters).
  - A 501-style "not configured" response if the secret is missing.
  - **Unsupported, documented:** RDATE; BYSETPOS/complex BY* combinations beyond ical.js defaults; VTODO/VJOURNAL; attachments.
  - CPU guard: measure parse time in tests with a 2-year synthetic feed; if it's too heavy, move parsing to a **Cron Trigger** (every 30 min) writing to KV.
- **`src/lib/itinerary/`**
  - `types`, `groupByDay(events, tz)`, `mergeFlights(trip)` (LY5107/LY5110 as fixed entries), `nowNext(events, now)`, `validatePayload`.
  - All-day handling: DTEND is exclusive.
- **`ItineraryPage`** (lazy, **tab bar**)
  - Replaces Flights in the tab bar; Flights moves to More/Plan.
  - Day sections 24–28 Feb (plus "Before"/"After" for 23 Feb and 1 Mar).
  - Times via `formatInZone(…,'Asia/Tbilisi')`, Hebrew titles in `dir="auto"`, a now/next highlight during the trip.
  - Empty state ("Nothing planned yet: add events to the גיאורגיה calendar"), error and stale states.
- **Home (during phase):** a "Today's plan" card under the day counter.
- **Icon:** `calendar`.
- **Tests:**
  - Worker:
    - ICS fixtures (TZID, UTC, all-day, weekly RRULE + EXDATE + override, folded Georgian/Hebrew lines, escapes);
    - fields stripped;
    - secret missing;
    - upstream failure → stale;
    - out-of-window events dropped.
  - lib: grouping across midnight in Tbilisi, flights merged, now/next.
- **Privacy note to Ofek:** event titles and locations become public on the site, so keep the calendar titles fit for public viewing.

**Manual steps for Ofek (8.4)**

1. Google Calendar (web) → ⚙️ Settings → under "Settings for my calendars" click **גיאורגיה** → **Integrate calendar** → copy **"Secret address in iCal format"**.
2. In **your own terminal** (not this chat): `cd ~/Documents/Personal/Vacations/Georgia/Website/worker && npx wrangler secret put CALENDAR_ICS_URL`, then paste at the hidden prompt.
3. Tell me "done". I'll verify through `/itinerary`, never by viewing the URL. If the address ever leaks, reset it in the same Google settings screen.

### Phase 8.5 — Weather, snow & webcams → `v1.6.0`

- **`src/data/zones.ts`:**
  ```ts
  Zone { id: 'base'|'mid'|'top'; name; liftNote; lat; lon; elevationM; webcam?: { provider:'youtube'; id; label; checkedOn } ; webcamNote? }
  ```
  - **base:** "Village · Marco Polo", 2,000 m; `webcamNote`: "No webcam at the hotel; nearest live cam: Soliko".
  - **mid:** "Goodaura hub", 2,700 m; Soliko cam.
  - **top:** "Kudebi top", 2,950 m; Kudebi cam.
- **Worker `GET /weather`**
  - Uses `RL_DATA`. TTL **30 min**, `maxStale` 24 h.
  - **One** Open-Meteo call for 3 coordinates + `elevation=2000,2700,2950`, `past_days=30`, `forecast_days=7`, `timezone=Asia/Tbilisi`, with the variables listed above.
  - Validated, then aggregated with **shared `src/lib/weather/`** functions (imported by the Worker, like `prompt.ts` imports data).
  - Payload:
    ```json
    { "fetchedAt":"<ISO>", "stale":false, "source":"open-meteo",
      "zones":[{ "id":"base", "elevationM":2000,
        "current":{ "tempC":-4.2, "windKmh":12, "code":71, "time":"2027-02-25T10:00+04:00" },
        "days":[{ "date":"2027-02-25", "minC":-9, "maxC":-2, "snowCm":6.3, "windMaxKmh":25, "code":73 } /* ×7 */],
        "lastSnowfall":{ "date":"2027-02-23", "cm":14.0 } | null,
        "snowDepthCm":{ "value":85, "estimated":true } | null }] }
    ```
  - About 48 upstream calls/day, well under 10k.
- **`src/lib/weather/`** (pure):
  - `lastSnowfall(days, thresholdCm = 0.5)` from past days;
  - `currentSnowDepth(hourly, now)` (m→cm, at the current hour);
  - `weatherCodeToIcon/label` (WMO table);
  - formatters (°C, km/h, cm);
  - `validateOpenMeteo`;
  - `isOffSeason` (all depth 0 → a valid state).
- **`components/weather/MountainZones.tsx`:** an original side-profile SVG.
  - 3 altitude bands with a snow cap whose thickness scales with depth (capped).
  - Temperature and depth labels per band, a Marco Polo marker at the base, ridge/pine styling from the map tokens.
  - `role="img"` + `<title>`/`<desc>`, plus a visually-hidden table with the same numbers.
  - Light/dark tokens; fits 375 px.
- **`WeatherPage`** (lazy, **tab bar**, replacing Game; Game moves to More/Fun)
  - Mountain graphic, a 7-day forecast strip per zone (tabs: base/mid/top), last snowfall, and "Snow depth: estimated (model)".
  - "Updated X min ago", with a stale badge.
  - Credit: "Weather data by Open-Meteo.com" (CC BY 4.0).
  - **Webcams:** a `WebcamCard` with a placeholder (zone + name) and a "Play live cam" button.
    - On tap it mounts a `youtube-nocookie.com/embed/<id>?autoplay=1&mute=1` iframe with a `title`.
    - It unmounts when scrolled away (IntersectionObserver) or when the tab is hidden.
    - Plus an "Open on YouTube ↗" link.
- **Icons:** `cloud-snow`, `video`.
- **Tests:**
  - lib: last snowfall (none / today / earlier), depth at the hour, off-season, code mapping, validation rejects;
  - Worker: success, upstream failure → stale, malformed payload;
  - component render data for the band heights (pure helper `bandSnowHeight`).
- **Acceptance:**
  - the live page shows 3 zones with real data;
  - the cams play only after a tap;
  - Lighthouse ≥ 90 / axe 0 in light and dark, 375 px OK, CLS 0 (fixed-size placeholders).

### Phase 8.6 — Assistant live context + polish → `v1.7.0`

- `worker/src/liveContext.ts`:
  - reads the **same cache keys** as `/itinerary`, `/weather` and `/rates` through `getOrRefresh`, with a 1.5 s per-source timeout;
  - builds a block of today's and tomorrow's events, a one-line weather summary per zone, and the GEL rates;
  - capped at `LIVE_CONTEXT_MAX_CHARS = 1200` (≈300 tokens);
  - missing sources are omitted.
- Prompt wording: "Live data as of {fetchedAt}; snow depth is a model estimate, not a measurement."
- **Tests:** budget truncation, a failed source omitted, timestamp present.
- **Final pass:**
  - Lighthouse and axe (light/dark, plus interactive states) on `/itinerary`, `/weather`, `/currency`, `/todo` and `/facts` (words);
  - 375 px overflow, CLS 0;
  - updates to the README, worker README (routes, secrets, KV, CI deploy), CLAUDE.md, PLAN.md and `docs/CODEBASE_REPORT.md`;
  - GitHub Release `v1.7.0`.

---

### Phase 8.7 — Offline mode + fallback rate → `v1.8.0` (added after Phase 8.2, on Ofek's request)

Goal: the site opens and works on the mountain with **no signal at all**, not just when a single request fails.

**1. Baked fallback rate**

- At build time, fetch the latest NBG rate (via the Worker's `/rates`, or NBG directly in CI) and write it to a generated module, e.g. `src/data/fallbackRates.ts`.
- `useRates` falls back to it when there's neither a saved rate nor a connection.
- It's labelled "**Approximate**: official rate from {date}". It may be weeks old, so the label must stay visible.
- Test: the label and the conversion with the baked rate; the build doesn't fail if the fetch fails (it keeps the previous file).

**2. Service worker**

- Use `vite-plugin-pwa` (Workbox, build-time only, no runtime dependency in our pages) or a small hand-written SW. Pick in the phase PR, with a size and complexity note.
- **Precache everything:** the app shell, all lazy page chunks, the facts and pistes data, the font and the icons. Then every page works offline, not just the ones already visited.
- **Runtime caching** for Worker routes (`/rates`, `/weather`, `/itinerary`): network-first with a timeout and cache fallback, so the last-seen itinerary and weather show offline with their timestamps and "stale" labels.
- **Updates:** a "New version available — Refresh" toast, using the existing toast system; no silent stale versions after a deploy.
- Never cache `/chat`. The assistant shows "You're offline" instead.
- A web app manifest (name, icons incl. the existing 180 px touch icon, theme colors) for a reliable iPhone "Add to Home Screen". Document the iOS Safari storage caveats in the README.

**Acceptance criteria**

- With the network cut after one visit, Home, Flights, Packing, To-do, Facts/Words, Currency (saved or baked rate), Map, Game, and the last-seen Itinerary and Weather all open.
- After a deploy, the update toast appears and refreshing loads the new version.
- Lighthouse performance and accessibility stay at the bar, with CLS 0.

### Cross-cutting

- **Every new Worker route:**
  - registered in the route table;
  - origin allowlist + `RL_DATA` limit;
  - TTL constants in `worker/src/limits.ts`;
  - `validate*` on upstream data;
  - tests for success, stale fallback and bad input.
- **Every new page:**
  - a `navigation.ts` entry (group), an Icon, `lazyPage`, `PageHeader`;
  - a FactPopups decision: block `/currency` and `/todo`; allow `/itinerary` and `/weather`.
- **Site runtime dependencies:** none added (ical.js is Worker-only).
- **Verification per phase:**
  - `npm run lint && npm run typecheck && npm test && npm run build`, plus Worker typecheck and test, green in CI;
  - after merge: curl the live Worker routes (with Origin), check the pages in Chrome at 375 px and desktop, and the headless axe/Lighthouse script;
  - report to Ofek and stop.

### Risks

| Risk                                                | Mitigation                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| Cache API no-op on workers.dev                      | KV-backed `CacheStore`, verified in 8.0                                |
| KV free-tier write limits                           | ~150 writes/day budget; memory micro-cache                             |
| Worker CPU 10 ms on ICS parse                       | Pre-filter, cache parsed JSON, Cron fallback                           |
| NBG endpoint changes or no licence                  | Validation + er-api fallback + stale cache; credit the source          |
| Open-Meteo snow depth unreliable at this resolution | "Estimated (model)" label; no measured claims                          |
| YouTube stream IDs rotate                           | `checkedOn` date, link fallback, an easy one-line update in `zones.ts` |
| Calendar titles public                              | Privacy note, whitelist, truncation                                    |
| El Al check-in window unverified                    | Wording "confirm in the El Al app"; due = departure − 3 h              |
| Georgian font/TTS per device                        | System-font stack; TTS hidden without a voice; Ofek's device checklist |
| Token scope                                         | Minimal custom token; widen only if the deploy fails, documented       |
