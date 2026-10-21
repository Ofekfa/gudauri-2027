# Gudauri 2027 ⛷️

A small companion website for our ski trip to Gudauri, Georgia (24–28 Feb 2027): a live countdown, flight details, personal packing lists, fun facts, a skiing game and a voice trip assistant.

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

## Project docs

- [`PLAN.md`](PLAN.md): the roadmap, phases and status
- [`CLAUDE.md`](CLAUDE.md): conventions, commands and architecture

## License

Code: MIT. Map data (from Phase 2): © OpenStreetMap contributors, available under the ODbL.
