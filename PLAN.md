# PLAN — Gudauri 2027

## Status

| Phase | Scope                                                                    | Status  | Tag     |
| ----- | ------------------------------------------------------------------------ | ------- | ------- |
| 1     | Scaffold, tooling, CI, Pages, nav shell, trip config, countdown, flights | ✅ Done | v0.1.0  |
| 2     | Avatars, map background, visual identity                                 | ✅ Done | v0.2.0  |
| 3     | Packing list                                                             | ✅ Done | v0.3.0  |
| 4     | Fun facts + pop-ups                                                      | ✅ Done | v0.4.0  |
| 5     | Skiing game                                                              | ✅ Done | v0.5.0  |
| 6     | Voice AI assistant + Worker proxy                                        | ✅ Done | v0.6.0  |
| 7     | Polish: a11y, perf, mobile QA                                            | ✅ Done | v1.0.0  |
| 8.0   | Round 2 foundations (nav, Worker router + CI deploy, list toolkit…)      | ✅ Done | v1.1.0  |
| 8.1   | Georgian words                                                           | ✅ Done | v1.2.0  |
| 8.2   | Currency converter                                                       | ✅ Done | v1.3.0  |
| 8.3   | Pre-flight to-do list                                                    | ✅ Done | v1.4.0  |
| 8.4   | Itinerary (Google Calendar)                                              | ✅ Done | v1.5.0  |
| 8.5   | Weather, snow & webcams                                                  | ✅ Done | v1.6.0  |
| 8.6   | Assistant live context + polish                                          | ✅ Done | v1.7.0  |
| 8.7   | Offline mode (service worker) + baked fallback rate                      | ✅ Done | v1.8.0  |
| 9.1   | Georgian food page                                                       | ⏳ Next | v1.9.0  |
| 9.2   | Background Georgian music                                                | ✅ Done | v1.10.0 |
| 10.1  | Shared lists across our phones (sync)                                    | ✅ Done | v1.11.0 |
| 10.2  | Avatar hair colours (Ron brown, Ofek light brown)                        | ✅ Done | v1.11.1 |
| 10.3  | Album: our trip in photos                                                | ✅ Done | v1.12.0 |

**Live:** https://ofekfa.github.io/gudauri-2027/

### Deviations from the original plan

- Phase 1: the router is in-house (`src/lib/router/hashRouter.ts`). Route metadata lives in `src/navigation.ts`, and the "More" tab is a page (`#/more`) rather than a pop-up sheet, which is simpler to navigate on phones.
- Phase 1: ESLint is pinned to v9 because `eslint-plugin-jsx-a11y` doesn't support v10 yet.
- Phase 2: map data comes straight from Overpass (OpenStreetMap). OpenSkiMap's worldwide GeoJSON is too large to clip for one resort, so it's credited and linked instead. 50 runs, 16 lifts, the hotel, the Friendship Monument and 6 peaks; regenerate with `npm run fetch:pistes`.
- Phase 2: eye colors not given in the brief were chosen (Ron, Roy: brown) and can be edited in `src/data/characters.ts`. Maya was later changed to brown eyes and glasses (see below). Skier pose uses a "pizza" wedge.
- Phase 2: the map page doesn't use pinch-zoom; zoom buttons (100–300%) plus native scrolling keep it simple and accessible. Phones open at 200%.
- Between phases 2 and 3: avatar tweaks per feedback (Maya brown eyes + glasses, Roy undercut, Ofek warmer skin), tagged as part of v0.3.0.
- Phase 10.2 (`v1.11.1`): hair colours per feedback: Ron brown (was black), Ofek light/ash brown (was blond). `og-image.png` regenerated with `npm run og-image`.
- `v1.11.2`: Roy's name is spelled **Roi** everywhere it's shown (his id stays `roy`, so stored lists, scores and sync keep working).
- Phase 10.3 (`v1.12.0`):
  - Album images also send `Access-Control-Allow-Origin: *`, so "Download all" can `fetch` them. They're public anyway, and no credentials are involved.
  - Viewed photos rely on the browser's HTTP cache (`immutable`) rather than a separate Cache Storage, and the service worker doesn't precache them.
  - "Added by" is whoever joined on this phone; there's no separate per-photo picker.
- Phase 3: a generic toast system (`src/lib/toast`) landed early because undo-delete needs it; Phase 4 fact pop-ups reuse it. Import confirmation is inline rather than a browser dialog. The starter template marks everything "Already have" by default.
- Phase 4: 55 facts (target 40+). A fact-check pass corrected the Kobi gondola year (2019), Khachapuri Index start (2011), speed-skiing record (255.5 km/h, 2023) and Military Road details. Unsupported details were dropped. Pop-ups are also paused on the Facts page, and the fact data loads lazily.
- Between phases 4 and 5: the Fun facts page became a one-at-a-time viewer (← → keys, swipe, Previous/Next) per feedback.
- Phase 5: the flags are obstacles (no slalom gates). The game is 60 fps in Chrome, with < 0.1 ms of JS per frame at p99. A CPU-throttled check was done in Phase 7 with 4× CPU throttling (60 fps, p95 16.8 ms). Testing on real phones is still open.
- Phase 6: the Worker is live at `https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev` (model `@cf/meta/llama-3.1-8b-instruct-fp8`). The site gets the URL from the repo variable `VITE_ASSISTANT_URL`. No per-IP daily cap: the free rate-limit binding only supports 10 s/60 s windows and is approximate (eventually consistent across Cloudflare locations; in testing a burst got 429s only after ~75 requests). The Workers AI free daily allowance is the hard cap.
- Phase 7 results (live site, Lighthouse mobile): performance 98–100, accessibility/best practices/SEO 100 on all 7 pages. FCP ≈ 1 s and CLS 0, after self-hosting the font (render-blocking Google Fonts removed) and fixing lazy-page layout shift. A headless axe sweep (2 phone sizes × light/dark + interactive states) is at 0 violations after fixing two findings. No horizontal overflow at 375/412/1280 px. Game at 4× CPU throttle: 60 fps, p95 16.8 ms. Added a link-preview image and an iOS home-screen icon. **Still open:** a hands-on check on real phones (iOS Safari speech input/read-aloud, Android Chrome), which needs physical devices.

- Phase 8.0: the CI and live checks showed `/health` and `/chat` unchanged after the Worker refactor. Worker CI deploys are wired up but **skip until Ofek adds the `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets**. The `CACHE` KV namespace is created when the first data route lands (8.2).

- Phase 8.0 follow-up: Ofek added the Cloudflare secrets, and a manual run of the Worker deploy workflow succeeded with the minimal token (Workers Scripts: Edit + Workers KV Storage: Edit). Worker deploys are now automatic.
- Phase 8.1: 27 words (target 20+) in `src/data/words.ts`, each with its own Wiktionary page. ანგარიში is glossed "account" on Wiktionary, so it's presented as "the bill (literally 'account')". No Georgian TTS voice was found on the test machine, so the "Hear it" button stays hidden there, by design. Georgian text uses system fonts via `:lang(ka)`; real-device rendering is on Ofek's checklist.

- Phase 8.2: KV namespace `CACHE` created with Ofek's approval (id in `worker/wrangler.toml`). `/rates` serves official NBG rates (12 h TTL, 7-day stale), with an ExchangeRate-API fallback. Friendly rounding was tuned to 1s below 50 (so ₾20 ≈ ₪24, not ₪25). The selects use short labels (₪ ILS / ₾ GEL / € EUR) to fit 375 px. At the time the site had no offline mode (8.7 added it), so "offline" meant the page loaded but the rates request failed; cached rates then show with a notice.

- Phase 8.3: the to-do list has five lists (four travelers + Shared). Day-based deadlines are the **end of that day in Israel time**, and check-ins are exact (departure − 3 h, shown in Israel time; LY5110's appears as 18:55 Israel = 20:55 Tbilisi). The El Al check-in window stays unverified and is worded as "usually ~24 h; confirm in the El Al app". The passport item points to Georgia's current entry rules rather than stating a validity requirement. The Home card reads storage synchronously so it never shifts the layout. Testing lesson: tap UI by DOM `click()` in headless tests (the fixed tab bar intercepts coordinate taps at 375 px), and wait for colour transitions before axe contrast checks.

- Phase 8.4: Ofek set `CALENDAR_ICS_URL` from his own terminal; it was never seen or echoed. The live feed gave 38 trip events. ical.js 2.2.1 adds about 60 kB gzipped to the Worker. A 2,000-event feed parses in ~1.2 ms thanks to the text pre-filter. Flights from `trip.ts` are merged unless the calendar already names the flight number. **Calendar data note for Ofek:** the calendar's flight events look ~2 h off; LY 5107 is stored as 09:15–11:50 Tbilisi time vs the real 07:15–09:50, and the return lands at 01:55 on 1 Mar vs a 23:55 departure on 28 Feb. Day-1 events were probably typed in Tbilisi times with the event time zone set to Israel. The site shows the calendar as stored. Lesson: after `npm install` in `worker/`, check the lockfile still lists the `@rolldown/binding-*` packages; if not, regenerate it from scratch.
- Phase 8.5: both Vitamin Cafe streams were re-checked through YouTube oEmbed on 2026-10-22 (Soliko `vBVWcSjPAZM`, Kudebi `aCHJ-r15RLM`); if a stream restarts with a new id, update `src/data/zones.ts`. One Open-Meteo call covers all three zones (elevation downscaling); the upstream response is ~70 kB and the Worker payload ~2.6 kB. Open-Meteo snaps all three zones to grid cells 3–8 km away, so only the elevation separates them, and snow depth is always labelled a model estimate. Nothing from YouTube loads until a cam is tapped. The forecast strip was made a 7-column grid because a sideways-scrolling list failed axe (keyboard-unreachable scroll region).
- Phase 8.6: the live-data block budget is **1,500** characters, not the planned 1,200. With the real calendar, the busiest two days plus weather and rates came to 1,299. Live checks showed the 8B model inverting the GEL rate (50 GEL → "42 ILS") and padding the plan with invented details. Fixed with ready-made conversions in the rates line, a plan header stating Tbilisi times and that day 1 starts in Israel, and prompt rules against inverting rates or adding durations, distances or places; it now answers "50 GEL = 60 ILS". Minor event mislabels can remain (a model limit). The chat tests had been calling real upstream APIs; they now stub `fetch`. Round 2 audit (live, 2026-10-22): 13 routes × 3 viewports with no overflow; axe 0 in light and dark on every route plus interactive states (words filter, currency swap, to-do Shared, weather Top with the cam playing, packing template); one `<h1>` per page; no console errors; Lighthouse mobile performance 97–100, accessibility 100, best practices 100, CLS 0 everywhere. The calendar's day-1 times now look corrected (the flight shows 07:15).
- Phase 8.7: **hand-written service worker** instead of `vite-plugin-pwa` (which would add `workbox-build`'s 37 dependencies and a runtime `workbox-window`); `sw.js` is 2 kB. **No service-worker caching of the Worker's data routes** (a planned item, dropped): the pages already keep versioned copies on the device with "Offline: updated X ago" labels, and a service-worker cache would answer offline as if live and hide them. The baked rate comes from NBG directly in the Pages deploy (`npm run fetch:rates`, never fails the build). The offline test found a router race: a hash change before `useHashPath` subscribed was ignored; fixed. Verified live: first visit controlled immediately; 29 files cached; with the network cut, all 12 pages open (including never-visited Map/Game/To-do); Itinerary/Weather/Currency show their saved copies with offline labels; a fresh device with no saved rate shows the "Approximate" baked rate; a real deploy triggered the "New version available" toast and Refresh loaded it.
- Phase 9.1: 38 dishes (matsoni soup dropped for thin sourcing; Lagidze waters corrected to Kutaisi). Two sources each, own words, no sponsored pages. 34 Commons photos, all checked by eye. Two were mislabeled on Commons and replaced ("Megrelian ajika" was a meat stew; the adjaruli shot was a dark oven); four dishes use an illustration with a per-dish emoji (💧 for Borjomi, not 🍷). The headless test caught a stale-state bug in the diet chips (fixed with functional updates). A live check showed the 8B assistant answering "lobiani is not vegetarian" flatly; added `diet.vegetarianOption` (khinkali, lobiani, chakapuli, chashushuli, satsivi), shown as a "Veg option" badge and in the assistant's dish line. The model still paraphrases it as "usually meat, but vegetarian versions exist". `Dish.name` (menu spelling, e.g. "Khinkali") was added as the title because the descriptive English name read oddly.
- Phase 9.2: **Licences** for background music, confirmed with Ofek: PD, CC0, CC BY, CC BY-SA, FAL, and, because the site is non-commercial, CC BY-NC, BY-NC-SA and **BY-NC-ND**. ND tracks are streamed unmodified (no trimming or re-encoding; loudness evened by player volume). **Library:** 49 tracks / 2.89 h (26 traditional, 23 modern), streamed from Wikimedia Commons and archive.org MP3 copies. The Hymnographical Collections were included because they're released by their publisher (Sameba Cross Monastery, Tsalka); "Acids" (a Moscow band) was dropped; one Chopin mazurka mastered at −37.5 LUFS was dropped as too quiet; loudness is targeted to −22 LUFS with up to −18 dB of attenuation. Openly licensed modern Georgian pop/rock/jazz is essentially absent, so `#/music` shows six official YouTube players instead (never as background audio). **Bugs found by end-to-end tests:** (1) the player re-picked a track whenever any pause/resume happened during a load, fixed with a track-request counter; (2) a dominant artist could cluster at the end of a shuffle cycle, fixed with weighted artist picks plus a must-play rule (0 back-to-back repeats over 5 cycles × 7 seeds); (3) archive.org returns transient HTTP 500s, so a failed track is retried once before being skipped. Game page keeps music; a hidden tab pauses it (Ofek's choice). I verified licences, URLs, durations and loudness, but couldn't audition the recordings.
- `v1.10.1` (Ofek's feedback): calendar times entered in Tel Aviv time looked unchanged because the itinerary showed everything in Georgia time. Now entries before we land are shown in **Israel time** (labelled), flights show both ends from the booking ("05:15 TLV → 09:50 TBS", "23:55 TBS → 00:35 TLV +1"), and the assistant's plan lines follow the same rule. Google's secret iCal feed had in fact updated; the Worker refetches every 20 minutes.

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
│  ├─ avatars/ ofek.tsx ron.tsx roy.tsx maya.tsx (+ ski poses) · parts.ts (shared face/skin/hair tokens)  ← as built: data/characters.ts + avatars/FaceArt.tsx, Avatar.tsx
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
- **Avatars:** hand-built SVG in a shared "sticker" style (same head shape, outline weight and eye style) with a parametric `parts.ts` (skin, hair shape and color, eye color). _(As built: the parameters live in `src/data/characters.ts` and are drawn by `src/avatars/FaceArt.tsx`.)_ Each traveler gets a `face` and a `ski` pose (with goggles, jacket in their color). `role="img"` + `aria-label="Ofek"`. All four are reviewed together side by side before moving on.
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

# Round 3

## Round 3 plan: Food page (9.1 → `v1.9.0`) + background music (9.2 → `v1.10.0`)

### Context

Round 2 is complete: phases 8.0–8.7 are ✅ and `v1.8.0` is live with offline mode. Ofek wants two more features: a Georgian food page with deep-linkable dishes, and gesture-started background Georgian music. Both build on the Round 2 foundations and don't duplicate them:

- nav groups and `MORE_GROUPS`;
- `loadVersioned`/`saveVersioned`;
- the toast store;
- the Fact union with its 11 `food` facts and the 27 `word-*` entries;
- the service worker;
- the Worker prompt.

All `CLAUDE.md` conventions, the quality bar and the PR/tag/stop workflow apply. Approved by Ofek on 2026-10-22.

#### Decisions (confirmed with Ofek)

| Topic             | Decision                                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Food placement    | More → **Fun**. The tab bar stays Home · Itinerary · Packing · Weather · More.                                                                                                                                                                                                                                       |
| Music licences    | Allowed: PD, CC0, CC BY, CC BY-SA, CC BY-NC **and CC BY-NC-ND**. NC is fine because the site is non-commercial; record this in PLAN.md. ND tracks are streamed **unmodified**: no trimming, re-encoding or mixing; loudness is evened by player volume, not by editing files.                                        |
| Modern music gap  | Openly licensed modern Georgian pop, rock and jazz is essentially non-existent. The background library covers traditional plus modern electronic and piano. A **visible Music page** adds official YouTube embeds of modern Georgian playlists (tap to load, per the YouTube terms), never used as background audio. |
| Hosting           | **Stream from source**: Wikimedia Commons (`upload.wikimedia.org`, CORS `*`) and archive.org (CORS `*`, range requests), using their MP3 copies. No audio in git and no R2.                                                                                                                                          |
| Game / hidden tab | **Keep playing on Game** (it has no audio of its own). **Pause when the tab is hidden or the phone locks**; resume on return unless the user muted.                                                                                                                                                                  |

#### Research findings (2026-10-22)

**Music** (counts are estimates and are verified per file by the 9.2 build script):

| Pool                                                                                | Era                                    | Tracks              | Minutes | Licences                                                       |
| ----------------------------------------------------------------------------------- | -------------------------------------- | ------------------- | ------- | -------------------------------------------------------------- |
| Commons: Chakrulo (1957), Shen khar venakhi                                         | trad.                                  | 2                   | 8.5     | PD                                                             |
| Commons: Sakhioba concert at Columbia (4 parts), Boryspil quartet                   | trad. (live)                           | 5 files (segmented) | ~60     | CC BY 3.0                                                      |
| Commons: anthems (Tavisupleba etc.)                                                 | ceremonial                             | ~3 picked           | ~5      | PD                                                             |
| archive.org: Kavsadze choir 1914 (Netavi Gogo, Mraval Zhamier)                      | trad. 78rpm                            | 2                   | 5.5     | CC BY-NC-ND 4.0 (recording PD in US)                           |
| archive.org: Supruli choir live 2012                                                | trad.                                  | 5                   | 20      | CC BY-NC-ND 3.0                                                |
| archive.org: Georgian Hymnographical Collection II/IV (Erkvanidze)                  | trad. chant                            | ≤19                 | ≤35     | CC BY-NC-ND 4.0 (uploader rights unverified, so needs a check) |
| archive.org: Rezo Glonti, Nika Japaridze, Miranda Shvangiradze, Levan Lomidze remix | modern electronic/piano                | ~14                 | ~65     | CC BY-NC-ND / BY-NC-SA                                         |
| Commons: Giorgi Latsabidze / Latsos Piano Duo                                       | modern performer, classical repertoire | up to ~35           | ~150    | PD / FAL / CC BY-SA                                            |

- **Excluded:** unlicensed 78rpm rips, the lending-only "unlockedrecordings" collection, CC labels on what look like ripped albums ("Igor / Rustavi", Nina Sublatti), Jamendo (its API terms forbid offline caching, and no verified Georgian artists), and Bandcamp ("all rights reserved").
- **Realistic library:** ~45–55 tracks and ≥ 2.5 h. Excluding Latsabidze, about 70% traditional; Latsabidze tracks are capped at ~10 so the mix still sounds Georgian.
- **Optional for Ofek:** ask the Tbilisi Conservatoire and AudioLabs for permission to stream the 1966 Erkomaishvili recordings (101 tracks, 7 h).

**Dish photos:** Commons has a freely licensed photo for 38 of 39 candidates; **penovani** has none, so it gets the illustrated placeholder. Bazhe and qvevri photos are weak. The Commons API returns `LicenseShortName`, `Artist` (HTML) and `LicenseUrl`. Its rate limits require ~2 s between calls and a User-Agent.

**Pitfalls:**

- Some category photos are mislabeled (lamb curry under Lobio, bread under Badrijani).
- Several good photos were taken outside Georgia, so captions never say "in Georgia".
- Lobiani isn't reliably vegetarian (Rachuli ham, lard).
- Pkhali is vegan but contains nuts.

#### Docs drift found (code wins; fixed in the 9.1 docs PR)

- **`CLAUDE.md`:**
  - the typecheck row omits `tsc -p src/sw`;
  - the commands table is split by a blank line and misses `fetch:rates`;
  - "lazy-loaded: game, assistant, map" — actually every page except Home, Flights and More is lazy.
- **`docs/CODEBASE_REPORT.md` ~l.361–366:** still describes the Round 1 tab bar ("Home · Flights · Packing · Game · More", 7-link desktop header). The scripts list (~l.733) misses `fetch:rates` and the service-worker typecheck.
- **`PLAN.md` 8.2 notes:** "The site has no offline mode" is superseded by 8.7.

---

### Phase 9.1 — Georgian food page → `v1.9.0`

PRs:

1. `docs/round-3-plan`
2. `feat/param-routes`
3. `feat/dish-data`
4. `feat/dish-images`
5. `feat/food-page`
6. `feat/assistant-dishes`
7. `docs/phase-9.1-status`

#### 1. Router: prefix routes with one param (no library)

- **`src/lib/router/hashRouter.ts`:** add a pure `matchRoute(path, exact: Record<string,T>, paramRoutes: Record<string,T>)` that returns `{ page, base, param? } | null`.
  - Exact match first.
  - Otherwise split into base + one segment: `/food/khinkali` gives `{ base: '/food', param: 'khinkali' }` when `/food` is in `paramRoutes`.
  - More than one extra segment gives `null`, so the page is NotFound.
  - Also add `basePath(path)`.
- **`src/app.tsx`:** add `PARAM_PAGES = { '/food': FoodDetailPage }`. The page receives `param` as a prop.
  - `findNavItem(basePath(path))` keeps titles and More highlighting working for detail pages.
  - The detail page sets `document.title` to the dish name.
  - An unknown dish id renders a friendly "Dish not found" with a link to `#/food`.
- **`FactPopups`:** the `BLOCKED_PATHS` check uses `basePath`.
- **Back from detail to `#/food`:** the list scrolls the last-viewed card into view and focuses it. The id is kept in module memory, not storage.
- **Tests:** `matchRoute` covers exact, param, unknown base, extra segments, trailing slash and query; `basePath`; navigation for `/food` and `/food/x` → More active.

#### 2. Dish data (`src/data/dishes.ts`, typed and validated)

```ts
type DishCategory = 'starters' | 'soups' | 'breads' | 'mains' | 'sauces' | 'sweets' | 'drinks';
interface Dish {
  id: string; // slug, e.g. 'khinkali'
  nameKa: string; // Mkhedruli, rendered with lang="ka"
  transliteration: string; // national system, like words.ts
  nameEn: string;
  category: DishCategory;
  description: string; // own words, ≤ 280 chars
  ingredients: string[];
  funFact?: string;
  region?: string; // e.g. 'Svaneti'
  diet: { vegetarian: boolean; vegan: boolean; nuts: boolean; spicy: 0 | 1 | 2 | 3 };
  dietNote?: string; // e.g. 'Often made with lard; ask'
  howToEat?: string;
  image: string | null; // key into dishImages (null → illustrated placeholder)
  sources: string[]; // https, ≥ 1 (en.wikipedia + one more where possible)
  relatedFactIds?: string[]; // existing FACTS ids (e.g. 'khinkali', 'pkhali', 'qvevri', 'supra')
}
```

- **About 36 dishes:**

  | Category          | Dishes                                                                                           |
  | ----------------- | ------------------------------------------------------------------------------------------------ |
  | Starters & salads | pkhali, badrijani nigvzit, jonjoli, ajapsandali, satsivi                                         |
  | Soups             | kharcho, chikhirtma, matsoni soup                                                                |
  | Breads & pastries | khachapuri imeruli, adjaruli, megruli, penovani; lobiani, kubdari, shoti/tonis puri, mchadi      |
  | Mains             | khinkali, mtsvadi, shkmeruli, ojakhuri, chakapuli, chashushuli, lobio, kupati, elarji, gebzhalia |
  | Sauces & cheese   | tkemali, ajika, bazhe, sulguni                                                                   |
  | Sweets            | churchkhela, pelamushi, gozinaki, tklapi                                                         |
  | Drinks            | qvevri wine, chacha, Lagidze waters, Borjomi, tarkhuna                                           |

  Final count 35–40, adjusted while verifying.

- **Ordering phrases:** `ORDERING_PHRASE_IDS` lists existing word ids (`word-bill`, `word-how-much`, `word-please`, `word-thanks`, `word-delicious`, `word-water`, `word-wine`, `word-bread`, `word-cheers`). They're rendered with the existing `WordCardBody`; no second words list.
- **Accuracy:** every claim is checked against its sources and written in our own words. Uncertain dietary facts go in `dietNote` rather than being guessed.
- **Worker size:** `dishes.ts` must not import assets. The Worker imports it for the prompt (§6).

#### 3. Images

- **`scripts/fetch-dish-images.ts`** (`npm run fetch:dish-images`, run by hand, rarely). A manifest maps each dish to a pinned Commons `File:` title.
  - Fetches `imageinfo` metadata and refuses anything whose licence isn't CC0/PD/CC BY/CC BY-SA.
  - Downloads a ~1600 px thumbnail (`iiurlwidth`), one at a time with a 2 s delay and a User-Agent.
  - Uses **sharp** (new dev dependency) to centre-crop to 4:3 and output **AVIF + WebP at 320 and 640 px** to `public/food/<id>-<w>.<ext>`.
  - Writes **`src/data/dishImages.ts`** (generated): `{ id, width, height, alt, author (HTML stripped), license, licenseUrl, sourceUrl (Commons file page), modified?: 'cropped, resized' }`.
- **Budget:** ≤ 60 kB per file. The script steps quality down until it fits, and `src/data/dishImages.test.ts` asserts every file on disk is ≤ 60 kB and has complete credits.
- **Manual review:** after generation I look at every image before committing, to catch mislabeled photos.
- **Placeholder:** penovani and any rejected photo use `DishIllustration`, an inline SVG in the map/mountain style (category emoji motif). Never a wrong photo.
- **Markup:** `<picture>` with AVIF and WebP `srcset` (`sizes`), explicit `width`/`height` (CLS 0), `loading="lazy"`, `decoding="async"`; eager on the detail hero.
- **Service worker:** add `food/` to the precache exclusion (≈36 dishes × 4 files ≈ 2–3 MB would bloat every install). Add a **runtime cache-first** route for same-scope `food/*` images (cache `gudauri-images`, kept across versions, capped by our own count). Viewed photos work offline; unviewed ones show the illustration via `onError`. Add `classify` tests.
- **Credits:** licence information on each detail page. An aggregated new **`#/credits`** page (More → Fun, plus a footer link) lists dish photos, music (9.2), map data and weather. Show the "cropped, resized" modification note required by CC BY/BY-SA.

#### 4. UI

- **`src/pages/FoodPage.tsx`** (lazy, More → Fun, icon `food`):
  - `PageHeader`;
  - a search box (`type="search"`, label) matching English, transliteration (diacritics- and `’`-insensitive) and Georgian;
  - filter chips (Vegetarian, Vegan, No nuts) with `aria-pressed`;
  - **sticky category chips** (buttons that scroll to and focus the section heading, not hash anchors) under the header;
  - category sections of cards. Each card is a link to `#/food/<id>` with image, `nameKa` (`lang="ka"`), transliteration, English name and diet badges (🌱 vegetarian, 🌿 vegan, 🥜 nuts, 🌶 spicy level, all text-labelled);
  - a result count with `aria-live="polite"` and an empty state with "Clear filters".
- **`src/pages/FoodDetailPage.tsx`:**
  - a back link;
  - the hero image with credit;
  - names, region, description, ingredients, diet badges and note, how to eat or order, fun fact;
  - **related facts** rendered from FACTS by id (title, text and source link, not copied);
  - an **"Ordering phrases"** block using `WordCardBody` for `ORDERING_PHRASE_IDS`;
  - sources.
- **`src/lib/food/selectors.ts`** (pure): `normalize`, `searchDishes`, `filterDishes`, `groupByCategory`.
- **Fact pop-ups are blocked on `/food` and `/food/*`.** The detail page already shows the linked facts, so pop-ups would duplicate them. The list has a search box, and blocking matches the existing rule for input-heavy pages (`/currency`, `/todo`).
- **New icons:** `food`, `music`, `play`, `pause`, `skip`, `credits`.

#### 5. Tests (9.1)

- **Data:** unique slug ids; 35–40 dishes; every category non-empty; required fields; Mkhedruli-only `nameKa`; https sources; `relatedFactIds` exist in FACTS; `ORDERING_PHRASE_IDS` exist and are `WordFact`s; `vegan ⇒ vegetarian`; `image` keys exist in `dishImages` with full credits and an allowed licence; files on disk ≤ 60 kB.
- **Selectors:** search across the 3 scripts (e.g. "khinkali", "ხინკალი", "dumpling"), filter combinations, grouping order.
- **Routing:** `matchRoute`/`basePath`; navigation; service-worker `classify` for `food/*` images.

#### 6. Assistant

- The current prompt is ~2.5k tokens of facts. A compact dish list (`nameEn (transliteration): ≤ 50-char one-liner`, ~36 × 60 chars ≈ 2.2k chars ≈ 600 tokens) fits.
- Food questions are a core use case, and grounding the 8B model in our verified list reduces made-up dishes.
- Add it as a **"Georgian dishes we know"** block in `worker/src/prompt.ts`, built from `dishes.ts` (no images). Capped by a `DISH_LIST_MAX_CHARS = 2500` constant with a test.
- Add `../src/data/dishes.ts` to the Worker tsconfig.
- Verify live: "What's kubdari?" and "Is lobiani vegetarian?".

#### 9.1 acceptance

- `#/food` lists ≥ 35 dishes with working search and filters.
- `#/food/khinkali` deep-links, the browser back button returns to the list with that card focused, and an unknown id shows "not found".
- Photos are licensed and credited, with no file over 60 kB.
- `#/credits` works.
- Lighthouse ≥ 90 / 100, axe 0 in light and dark (including filtered and detail states), no overflow at 375 px, CLS 0.
- Offline: list and detail open, viewed photos show, others show the illustration.

---

### Phase 9.2 — Background music → `v1.10.0`

PRs:

1. `feat/track-data`
2. `feat/music-engine`
3. `feat/music-ui`
4. `feat/speech-ducking`
5. `feat/music-page` (embeds)
6. `docs/phase-9.2-status`

#### 1. Track data and scripts

- **`src/data/tracks.ts`:**
  ```ts
  interface Track {
    id: string;
    title: string;
    titleKa?: string;
    artist: string;
    era: 'traditional' | 'modern';
    durationS: number;
    src: string; // https MP3 on upload.wikimedia.org or archive.org
    startS?: number; // play a segment of a long CC BY concert file (never used for ND tracks)
    endS?: number;
    gainDb: number; // measured, applied as volume attenuation
    license:
      'PD' | 'CC0' | 'CC BY' | 'CC BY-SA' | 'CC BY-NC' | 'CC BY-NC-SA' | 'CC BY-NC-ND' | 'FAL';
    licenseUrl: string;
    sourceUrl: string;
    attribution: string;
  }
  ```
  (BY-NC-SA and FAL are included because they're share-alike variants of allowed terms; this is recorded in PLAN.md.)
- **`scripts/analyze-tracks.ts`** (`npm run analyze:tracks`, manual):
  - for each candidate, checks the URL with a HEAD and range request;
  - reads the duration with ffprobe;
  - measures loudness with `ffmpeg -af loudnorm=print_format=json` (over the segment, if any);
  - writes `durationS` and `gainDb = clamp(TARGET_LUFS − measured, −12, 0)`. Only attenuation, so `audio.volume` can apply it without Web Audio or CORS.
  - **No transcoding** (ND-safe and nothing to host).
- **Curation:** I check each item's licence on its page, prefer the MP3 copy (archive.org `_vbr.mp3`/`.mp3`; Commons `transcoded/…/.mp3`), and listen to a sample of each.
  - Latsabidze is capped at ~10 tracks.
  - Unverifiable uploader rights mean the item is excluded.

#### 2. Engine: `src/lib/music/`, framework-free and lazy-loaded except a tiny core

- **`settings.ts`:** a versioned `music:settings` record `{ version: 1, enabled, volume }` via `loadVersioned`/`saveVersioned`.
  - Default `enabled: true`. When `navigator.connection.saveData` is set or `effectiveType` is `2g`/`slow-2g`, the default is `false` with a one-line note.
  - An explicit user choice is always kept.
- **`shuffleBag.ts`:** a versioned `music:bag` record `{ version: 1, remaining: string[], lastArtist, recentEras }` with an injected RNG.
  - Picks from `remaining`, preferring a different artist and avoiding three of the same era in a row.
  - Refills when empty, and the new cycle's first pick avoids the previous artist.
  - The bag survives reloads. Unknown or removed ids are dropped and new ones added.
- **`machine.ts`** (pure state machine):
  - states `idle-waiting-gesture` → `loading` → `playing` ⇄ `paused-user` (muted), plus `ducked`, `paused-hidden` and `unavailable` (offline or repeated failures);
  - events: `GESTURE`, `READY`, `ENDED`, `ERROR`, `TOGGLE`, `NEXT`, `SPEECH_START`/`SPEECH_END`, `HIDDEN`/`VISIBLE`, `ONLINE`/`OFFLINE`;
  - invariant: **never play once the user has muted.**
- **`player.ts`:** owns one `<audio>` element created in the App shell (`MusicHost`).
  - `volume = settings.volume × 10^(gainDb/20)`, multiplied by a duck factor (0.2 while TTS speaks, 0 while the mic listens).
  - Segment playback seeks to `startS` and stops at `endS`.
  - `error`/`stalled` (after a timeout) → log in dev and skip. Three consecutive failures → `unavailable` with "Music needs a connection".
  - Preloads only the **next track's metadata** (a second `Audio` with `preload="metadata"`).
  - Media Session: metadata plus play/pause/next handlers.
- **Gesture gating with iOS in mind:**
  - The shell adds one capture-phase `pointerdown`/`keydown` listener.
  - On the first gesture, if enabled, it synchronously "unlocks" the `<audio>` element by playing a ~100-byte inline silent clip inside the gesture.
  - It then lazy-imports the engine chunk and starts the first track.
  - Until then, only the header hint "♪ Music ready — tap anywhere" shows.
  - No audio is fetched before that first gesture.

#### 3. UI

- **`components/music/MusicControl.tsx`**, in the header on the right, on mobile and desktop:
  - a play/pause (mute) icon button with a label (`aria-pressed`) and a "next" button;
  - a "now playing" disclosure button (`aria-expanded`) that opens an in-flow panel, not a modal: title, artist, era tag, licence + source link, and a volume slider (`<input type="range">` with a label);
  - track changes are announced in a visually hidden `aria-live="polite"` region; focus is never moved;
  - it doesn't take a tab-bar slot.
- **`#/music`** (More → Fun):
  - the full credits list for the background library;
  - an **"Modern Georgian music"** section with official YouTube playlist embeds (tap to load, `youtube-nocookie`, the same pattern as `WebcamCard`), with playlist ids chosen and verified during the phase;
  - starting an embed pauses the background music.
- `#/credits` gains the music section.

#### 4. Coexistence

- **`src/lib/speech/activity.ts`:** a tiny store `{ listening, speaking }`.
  - `AssistantPage` sets `listening` in `toggleListening`/`onEnd`/`onError`.
  - `synthesis.ts` sets `speaking` from `utterance.onstart`/`onend`/`onerror`, which also covers the WordCard "Hear it" button.
  - The music store subscribes: **pause while listening** (the mic would pick up the music), **duck to 20% while speaking**, and resume afterwards.
- **Game:** keeps playing.
- **Hidden tab:** pauses on `visibilitychange` → hidden and resumes on visible (only if it was playing).
- **Service worker:** audio is cross-origin, so it is never cached (unchanged routing). Offline → `unavailable`.

#### 5. Tests (9.2)

- **Shuffle bag:** no repeats within a cycle (exhaustive over 5 cycles), persistence across reload (store round-trip), no back-to-back artist, era alternation bound, ids added or removed between versions.
- **Settings:** default-on, Save-Data default-off, an explicit choice persists, corrupt or future records.
- **Machine:** no start before a gesture; gesture + enabled → loading; gesture + muted → stays silent; mute while loading never plays; error → skip; three errors → unavailable; speech events duck or pause and resume to the prior state; hidden/visible.
- **Track data:** allowed licences only, https `src`/`sourceUrl`/`licenseUrl`, `durationS > 0`, `gainDb ∈ [−12, 0]`, no `startS`/`endS` on ND tracks, unique ids, **≥ 40 tracks and ≥ 9,000 s total**, era share reported and modern ≥ 20%.

#### 6. Performance

- Music modules are lazy chunks.
- The main bundle gains only `MusicControl` (placeholder state) and the gesture listener, under 3 kB gzipped.
- Lighthouse runs without a gesture, so no audio loads and the scores are unchanged.

#### 9.2 acceptance

- First visit: the hint shows. The first tap starts music, and switching pages doesn't interrupt it.
- Mute is remembered across reloads; a muted returning visitor hears nothing.
- Next track skips; the shuffle doesn't repeat within a session.
- The lock screen shows the title and controls.
- The assistant's mic pauses the music and TTS ducks it; the Game page keeps playing; a hidden tab pauses it.
- A broken URL is skipped and the player never sticks.
- Credits are complete.
- Quality bar met.

---

### Cross-cutting

- **New dev dependency:** `sharp` (image pipeline only). No runtime dependencies.
- **New conventions** in CLAUDE.md:
  - **Images:** Commons only, an allowed-licence list, generated credits, ≤ 60 kB, `<picture>` with width/height, runtime-cached, never hotlinked.
  - **Audio:** an allowed-licence list including NC/ND, ND unmodified, stream from source, gesture-gated, never play after mute.
  - **Licensing:** every third-party asset has its credits recorded in data and shown on `#/credits`.
- **Every phase:** lint, typecheck, test and build (+ Worker); after merge, live verification (curl, the headless audit script, Lighthouse); update `PLAN.md`, `CLAUDE.md` and `docs/CODEBASE_REPORT.md`; tag; report the URL + bullets; **STOP**.

### Verification

- **Unit:** `npm test` (the new data, selector, router, service-worker, music and speech tests); `cd worker && npm test` (dish-list budget).
- **Headless (puppeteer, 375 px + desktop, light and dark, axe):**
  - `#/food` search and filters; `#/food/khinkali` → back focuses the card; `#/food/nope`; `#/credits`.
  - Music: hint before the gesture; a click starts it (audio element `!paused`, `currentTime` advancing); mute + reload stays silent; next; a blocked track URL is skipped.
  - A faked `speechSynthesis` start/end ducks and restores the volume.
  - `visibilitychange` pauses and resumes playback.
- **Offline:** the 8.7 offline script extended to Food, with viewed and unviewed images.
- **Lighthouse** on all routes, live.

### Risks

| Risk                                                | Mitigation                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Uploader rights on archive.org items are unclear    | Only include items with a credible rights holder; exclude the rest; document each in tracks.ts |
| Source files are removed or renamed                 | `analyze:tracks` re-check script; skip-on-error; three failures → unavailable                  |
| iOS blocks play after an async import               | Synchronous silent unlock inside the gesture                                                   |
| Mobile data use (music on by default while roaming) | Save-Data/2g → off; ~1 MB per minute noted in the now-playing panel; one tap to mute           |
| Mislabeled Commons photos                           | Pinned files and manual visual review; illustration fallback                                   |
| Dish accuracy (diet, origins)                       | Two sources where possible; `dietNote` for uncertainty; tests for vegan ⇒ vegetarian           |
| Prompt growth                                       | Capped dish block (≈600 tokens) with a test                                                    |
| Precache bloat                                      | `food/` excluded; runtime image cache                                                          |

### Manual steps for Ofek

- **9.1:** none, apart from reviewing the dish list.
- **9.2:**
  - Optionally email the Tbilisi Conservatoire's International Research Center for Traditional Polyphony and AudioLabs Erlangen to ask permission for the Erkomaishvili recordings. I'll draft the email; you send it.
  - Test on your iPhone: first-tap start, lock-screen controls, and that locking pauses the music.

# Round 4

## Phase 10.1 — Shared lists across our phones → `v1.11.0`

Packing lists and to-dos lived only on each phone. Decisions (Ofek, 2026-10-22): **one shared group code**, **everyone can edit every list**, **packing and to-dos** sync.

- **Server:** a Durable Object (`ListsStore`, SQLite-backed, Workers Free plan) on the existing Worker stores each list item as a record `{ doc, key, value | tombstone, by, rev }`. **`POST /sync`** `{ doc, since, by, changes[] }` applies the changes (the last to arrive wins per item; deletes are tombstones) and returns every record changed since `since` plus the new revision.
  - Auth: `Authorization: Bearer <group code>` compared in constant time with the Worker secret **`GROUP_CODE`** (Ofek sets it with `wrangler secret put`; never in chat or git). Without the secret, `501` and the site works as before.
  - `RL_DATA` rate limit; size and count caps; incoming values are validated again on every phone.
- **Client** (`src/lib/sync/`): state ↔ records adapters for packing and to-dos; a persisted base snapshot per doc. Each sync sends the diff since the last sync and merges the server's changes without losing edits made while a request was in flight.
  - **When it syncs:** on load, after edits (debounced), every 15 s while visible, and on return to the tab. Works offline and catches up later.
- **UI:** a "Sync" panel on Packing and To-do (join with the code, pick whose phone this is, status: synced X ago / offline / wrong code). Items changed by someone else show who changed them.
- **First sync** merges each phone's existing lists; nothing is lost.
- **Privacy:** list contents are stored in our Cloudflare account and reachable only with the code.
- **Tests:** record diff/merge, adapters, client merge during an in-flight sync, Durable Object merge rules, route auth/validation.
- **Manual step for Ofek:** choose a long passphrase, run `npx wrangler secret put GROUP_CODE` in `worker/`, and share the code privately with Ron, Roy and Maya.

**Status (2026-10-22):** shipped as `v1.11.0`. The Durable Object deployed on the Workers Free plan. Verified end to end with a local Worker (emulated Durable Object) and two separate browser profiles: join, see the other phone's item with "· Ofek", tick it and see it packed with "· Maya" on the first phone, wrong code rejected. Live `/sync` answers `501` until Ofek sets `GROUP_CODE`.

## Phase 10.3 — Album: our trip in photos → `v1.12.0`

A page of frames, one per moment of the trip in story order; any of us adds photos to any frame in two taps (camera or gallery), and the page fills up into a visual story.

**Decisions (Ofek, 2026-10-22):**

- **Placement:** More → Fun.
- **Frames:** 5 dinner frames (Wed 24 – Sun 28 Feb, from `trip.ts`) and 3 bonus frames ("The four of us", "Best view", "Funniest moment"); 19 planned + 3 bonus.
- **Viewing is public:** anyone with the site link can see the photos.
- **Adding, captions, cover and deleting** need the **group code** (`GROUP_CODE`, shared with the lists). All four of us can delete.
- **Quick add** on Home during the trip.

**Storage:** Durable Objects SQLite. R2 most likely needs a card, and KV's 1 GB / 1,000 writes per day doesn't fit.

- An `AlbumStore` class (migration `v2`) with an **index** instance (photo metadata, frame covers, versions for ETags) and one **frame** instance per frame for image BLOBs (thumb ≤ 150 kB, full ≤ 1.6 MB, 2 MB row cap).
- Never in git.

**Access:** `POST /album/session` exchanges the group code (constant-time compare, `RL_AUTH` 5/min) for an HMAC-SHA256 token signed with **`ALBUM_SIGNING_KEY`**, valid until 2027-03-15 at least (renewed silently).

- `GET /album` and images are public. Images are served with `Cache-Control: public, immutable` and `X-Robots-Tag: noindex`.
- Every change needs the token.

**Routes:**

- `POST /album/session`
- `GET /album`
- `POST /album/:frameId/photos` (multipart: meta + full + thumb; idempotent by client id)
- `PATCH /album/photos/:photoId` (caption, `If-Match`)
- `DELETE /album/photos/:photoId`
- `PUT /album/:frameId/cover` (`If-Match`)
- `GET /album/photos/:photoId/image?size=thumb|full`

**Server validation:** JPEG magic bytes, sizes, known frame, cap of 30 per frame, caption ≤ 120 chars; EXIF re-stripped.

**Client:**

- **Image pipeline:** EXIF orientation applied, canvas re-encode to JPEG (Safari can't encode WebP) at 2048 px / 480 px, ≤ 1.5 MB, metadata stripped and verified.
- **Upload queue:** IndexedDB, 2 at a time, exponential backoff, offline resume, lives in the app shell, `beforeunload` while pending.
- **Optimistic tiles** with progress; Undo toast.
- **Viewer:** frame viewer with swipe/keys reusing the facts carousel helpers.
- **Story mode;** **Download all** as a ZIP writer with no dependency.
- **Routing:** the client router supports two detail segments (`#/album/<frame>/<photo>`); the Worker router supports `:params` and PATCH/PUT/DELETE.

**Manual step for Ofek:** `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put ALBUM_SIGNING_KEY` in `worker/`.

**Status (2026-10-22):** shipped as `v1.12.0` in PRs #87–#90.

- **Local end-to-end check** (`wrangler dev` + preview, emulated iPhone 13, real canvas pipeline):
  - **privacy:** a GPS-tagged photo with EXIF orientation 6 arrives upright with no EXIF, GPS or camera make;
  - **adding:** the tile appears at once; gallery multi-select works; Undo removes exactly that photo;
  - **offline:** an offline photo waits ("1 waiting for signal") and uploads after a reload on Home;
  - **viewing:** a phone that hasn't joined can view but not add;
  - **viewer:** caption, cover and delete (the cover resets) work; story mode works; Quick add suggests tonight's dinner;
  - axe 0 in light and dark; CLS 0; no overflow at 375 px.
- **Live:** viewing works. `POST /album/session` answers `501` until Ofek sets `ALBUM_SIGNING_KEY`, so adding is off until then.
- **Not checked:** real iPhone and Android phones (camera, HEIC → JPEG, upload on mountain signal) still need Ofek's test.
