/** Pure geometry helpers for turning OSM lat/lon into compact SVG paths. */

export interface LatLon {
  lat: number;
  lon: number;
}
export type Point = [number, number];

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function polylineLengthM(points: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineM(points[i - 1]!, points[i]!);
  return total;
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Equirectangular projection around the bounds' mid-latitude. Accurate enough
 * for a ~10 km resort; north is up and x/y are in units of `width`.
 */
export function createProjection(bounds: Bounds, width: number) {
  const midLat = toRad((bounds.north + bounds.south) / 2);
  const spanX = (bounds.east - bounds.west) * Math.cos(midLat);
  const spanY = bounds.north - bounds.south;
  const scale = width / spanX;
  return {
    width,
    height: spanY * scale,
    project: ({ lat, lon }: LatLon): Point => [
      (lon - bounds.west) * Math.cos(midLat) * scale,
      (bounds.north - lat) * scale,
    ],
  };
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(x - x1, y - y1);
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
}

/** Ramer–Douglas–Peucker line simplification. */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= tolerance) return [first, last];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

export function roundPoint([x, y]: Point, decimals = 1): Point {
  return [round(x, decimals), round(y, decimals)];
}

/** "M1 2L3 4L5 6" (closed rings get a trailing Z). */
export function toSvgPath(points: Point[], closed = false): string {
  const body = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join('');
  return closed ? `${body}Z` : body;
}
