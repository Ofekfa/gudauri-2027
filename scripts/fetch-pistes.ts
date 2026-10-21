/**
 * One-off data build: downloads Gudauri's runs, lifts and a few landmarks from
 * OpenStreetMap (via the Overpass API), projects them to a local SVG coordinate
 * system, simplifies them and writes src/data/pistes.json.
 *
 *   node scripts/fetch-pistes.ts
 *
 * Data © OpenStreetMap contributors, ODbL 1.0. The output is a derived database
 * and stays under the ODbL (see README).
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type {
  Difficulty,
  LiftKind,
  MapLift,
  MapPoi,
  MapRun,
  PisteMap,
  PoiKind,
} from '../src/lib/map/types.ts';
import {
  createProjection,
  polylineLengthM,
  roundPoint,
  simplify,
  toSvgPath,
  type Bounds,
  type LatLon,
} from './lib/geometry.ts';

const OUTPUT = fileURLToPath(new URL('../src/data/pistes.json', import.meta.url));

/** Covers the resort, the Kobi gondola to the north and the Friendship Monument to the west. */
const BOUNDS: Bounds = { south: 42.445, west: 44.44, north: 42.56, east: 44.525 };
const MAP_WIDTH = 1000;
/** Max deviation (map units, ≈7 m each) allowed when simplifying lines. */
const SIMPLIFY_TOLERANCE = 1.2;
const MIN_PEAK_ELEVATION_M = 2900;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const MAX_ATTEMPTS = 6;
const INITIAL_BACKOFF_MS = 5_000;
const USER_AGENT = 'gudauri-2027-site (github.com/Ofekfa/gudauri-2027)';

/** Landmarks we want, matched by exact OSM name, with friendlier display names. */
const LANDMARKS: { osmName: string; display: string; kind: PoiKind }[] = [
  { osmName: 'Marco Polo', display: 'Marco Polo Hotel (our base)', kind: 'hotel' },
  {
    osmName: 'Georgia-Russia Friendship Monument',
    display: 'Friendship Monument',
    kind: 'monument',
  },
];

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  geometry?: LatLon[];
  lat?: number;
  lon?: number;
  center?: LatLon;
}

function buildQuery(): string {
  const b = `${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east}`;
  const landmarks = LANDMARKS.map((l) => `nwr["name"="${l.osmName}"](${b});`).join('');
  return `[out:json][timeout:90];
(way["piste:type"="downhill"](${b});way["aerialway"](${b}););
out geom tags;
(${landmarks}nwr["name:en"="Georgia-Russia Friendship Monument"](${b});node["natural"="peak"]["ele"](${b}););
out center tags;`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchOverpass(query: string): Promise<OsmElement[]> {
  let backoff = INITIAL_BACKOFF_MS;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const endpoint = ENDPOINTS[(attempt - 1) % ENDPOINTS.length]!;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
      });
      if (res.ok) return ((await res.json()) as { elements: OsmElement[] }).elements;
      console.warn(`Attempt ${attempt}: ${endpoint} → HTTP ${res.status}`);
    } catch (err) {
      console.warn(`Attempt ${attempt}: ${endpoint} → ${(err as Error).message}`);
    }
    await sleep(backoff);
    backoff *= 2;
  }
  throw new Error('Overpass API unavailable; try again later.');
}

const DIFFICULTIES: Record<string, Difficulty> = {
  novice: 'novice',
  easy: 'easy',
  intermediate: 'intermediate',
  advanced: 'advanced',
  expert: 'advanced',
  freeride: 'advanced',
};

const LIFT_KINDS: Record<string, LiftKind> = {
  gondola: 'gondola',
  cable_car: 'gondola',
  mixed_lift: 'gondola',
  chair_lift: 'chair_lift',
  drag_lift: 'drag_lift',
  't-bar': 'drag_lift',
  'j-bar': 'drag_lift',
  platter: 'drag_lift',
  rope_tow: 'drag_lift',
  magic_carpet: 'magic_carpet',
};

const displayName = (tags: Record<string, string>) => tags['name:en'] ?? tags.name ?? null;
const isLatin = (s: string) => /^[\p{Script=Latin}\d\s\-'.()]+$/u.test(s);
const NON_LIFT_AERIALWAYS = new Set(['station', 'pylon', 'goods', 'zip_line']);

async function main() {
  const { project, width, height } = createProjection(BOUNDS, MAP_WIDTH);
  const toPath = (geometry: LatLon[], closed = false) => {
    const points = simplify(geometry.map(project), SIMPLIFY_TOLERANCE).map((p) => roundPoint(p));
    return { points, path: toSvgPath(points, closed) };
  };

  const elements = await fetchOverpass(buildQuery());
  const runs: MapRun[] = [];
  const lifts: MapLift[] = [];
  const pois: MapPoi[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === 'way' && el.geometry && tags['piste:type'] === 'downhill') {
      const area = tags.area === 'yes';
      runs.push({
        id: `w${el.id}`,
        name: displayName(tags),
        difficulty: DIFFICULTIES[tags['piste:difficulty'] ?? ''] ?? 'unknown',
        path: toPath(el.geometry, area).path,
        lengthM: Math.round(polylineLengthM(el.geometry)),
        ...(area ? { area: true as const } : {}),
      });
    } else if (el.type === 'way' && el.geometry && tags.aerialway) {
      if (NON_LIFT_AERIALWAYS.has(tags.aerialway)) continue;
      const { points, path } = toPath(el.geometry);
      lifts.push({
        id: `w${el.id}`,
        name: displayName(tags),
        kind: LIFT_KINDS[tags.aerialway] ?? 'other',
        path,
        stations: [points[0]!, points[points.length - 1]!],
        lengthM: Math.round(polylineLengthM(el.geometry)),
      });
    } else {
      const pos = el.center ?? (el.lat !== undefined ? { lat: el.lat, lon: el.lon! } : null);
      if (!pos) continue;
      const [x, y] = roundPoint(project(pos));
      const landmark = LANDMARKS.find(
        (l) => l.osmName === tags.name || l.osmName === tags['name:en'],
      );
      const ele = tags.ele ? Math.round(Number.parseFloat(tags.ele)) : undefined;
      if (landmark) {
        if (pois.some((p) => p.name === landmark.display)) continue;
        pois.push({
          id: `${el.type[0]}${el.id}`,
          name: landmark.display,
          kind: landmark.kind,
          x,
          y,
        });
      } else if (tags.natural === 'peak' && ele && ele >= MIN_PEAK_ELEVATION_M) {
        const name = displayName(tags);
        if (!name || !isLatin(name)) continue;
        pois.push({ id: `n${el.id}`, name, kind: 'peak', x, y, eleM: ele });
      }
    }
  }

  // Stable output so re-runs produce minimal diffs.
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  const data: PisteMap = {
    width,
    height: Math.round(height),
    runs: runs.sort(byId),
    lifts: lifts.sort(byId),
    pois: pois.sort(byId),
    fetchedAt: new Date().toISOString().slice(0, 10),
  };
  await writeFile(OUTPUT, `${JSON.stringify(data)}\n`);
  console.log(
    `Wrote ${OUTPUT}: ${runs.length} runs, ${lifts.length} lifts, ${pois.length} landmarks.`,
  );
}

await main();
