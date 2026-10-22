# Gudauri 2027 ⛷️

A small companion website for our ski trip to Gudauri, Georgia (24–28 Feb 2027).

| Section                       | What it does                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Home** (`#/`)               | Countdown to takeoff, next to-dos before the trip, "Day X of 5" and today's plan during it; meet the crew    |
| **Itinerary** (`#/itinerary`) | Day-by-day plan from our shared Google Calendar plus our flights, in Georgia time, with now/next highlights  |
| **Packing** (`#/packing`)     | Per-person lists with categories, need-to-buy/have, filters, progress, starter template, JSON backup         |
| **Weather** (`#/weather`)     | Forecast and modeled snow at 2,000/2,700/2,950 m on an illustrated mountain, plus tap-to-play live cams      |
| **Flights** (`#/flights`)     | Both legs in each airport's local time, flight duration, baggage                                             |
| **To-do** (`#/todo`)          | Pre-flight checklists per person plus a shared list, with due dates and a link to missing packing gear       |
| **Currency** (`#/currency`)   | Lari ⇄ shekel ⇄ euro converter on official National Bank of Georgia rates, with quick tables; works offline  |
| **Fun facts** (`#/facts`)     | 82 checked facts including 27 Georgian words, one at a time (swipe / ← →), plus occasional pop-ups (mutable) |
| **Ski map** (`#/map`)         | Original illustrated map of Gudauri's runs and lifts from OpenStreetMap                                      |
| **Ski game** (`#/game`)       | Canvas downhill game with all four characters and per-skier high scores                                      |
| **Assistant** (`#/assistant`) | Voice/text AI trip assistant on a free Cloudflare Workers AI model, aware of today's plan, weather and rates |

The phone tab bar shows Home · Itinerary · Packing · Weather · More; everything else is under More, grouped into Plan, Tools and Fun.

Mobile-first, with light and dark mode, and keyboard and screen-reader friendly. Lighthouse (mobile) scores 98–100 on every page.

**Live site:** https://ofekfa.github.io/gudauri-2027/

## Local setup

Requires Node 22+.

```sh
npm install
npm run dev        # http://localhost:5173/gudauri-2027/
npm test           # unit tests
npm run lint       # ESLint + Prettier
npm run build      # production build in dist/
```

Copy `.env.example` to `.env.local` to set optional variables (none needed yet).

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`, which lints, tests, builds and publishes `dist/` to GitHub Pages. Pull requests run `.github/workflows/ci.yml`. The Vite `base` is `/gudauri-2027/` (see `vite.config.ts`). Rename it if the repo is renamed.

## Editing trip details

All trip facts live in [`src/data/trip.ts`](src/data/trip.ts). Times are ISO 8601 strings with the local airport's UTC offset, e.g. `'2027-02-24T09:50:00+04:00'` for 09:50 in Tbilisi. Use `TBC` for an unknown time.

## Cloudflare Worker

A small Cloudflare Worker in [`worker/`](worker/README.md) powers the assistant (a free Workers AI model, no API keys) and serves cached live data: `/itinerary` (from a secret calendar address), `/weather` (Open-Meteo) and `/rates` (National Bank of Georgia).

- **Live Worker:** `https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev`
- **How the site finds it:** the build reads the GitHub repo variable `VITE_ASSISTANT_URL`; for local dev, use `.env.local`.
- **Redeploying the Worker:** automatic from `main` via `.github/workflows/worker-deploy.yml` (or `cd worker && npx wrangler deploy`)

## Ski map data

`src/data/pistes.json` is generated from OpenStreetMap by `npm run fetch:pistes` (Node 22.18+ runs the TypeScript script directly). It uses the public Overpass API, so run it rarely; it retries with backoff. The map artwork is original. We never use the resort's official piste map.

## Project docs

- [`PLAN.md`](PLAN.md): the roadmap, phases and status
- [`CLAUDE.md`](CLAUDE.md): conventions, commands and architecture

## Data sources and credits

- Weather: [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0, non-commercial use). Snow depth is a model estimate.
- Exchange rates: National Bank of Georgia official rates; fallback [ExchangeRate-API](https://www.exchangerate-api.com).
- Live cams: Vitamin Cafe Gudauri streams on YouTube, embedded via youtube-nocookie.com only after a tap.
- Georgian words: checked against Wiktionary.

## License

Code: MIT. Map data in `src/data/pistes.json`: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/). Run and lift data can also be browsed on [OpenSkiMap.org](https://openskimap.org).
