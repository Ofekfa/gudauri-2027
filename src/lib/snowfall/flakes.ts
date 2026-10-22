/**
 * The background snowfall's flakes: how many for a viewport and what each
 * looks like. Pure and deterministic (seeded), so the layout is stable.
 */

/** Flakes on any screen, plus more per megapixel of viewport, up to a cap. */
export const BASE_FLAKES = 36;
export const FLAKES_PER_MEGAPIXEL = 18;
export const MAX_FLAKES = 110;
/** Diameter: MIN_SIZE_PX up to MIN_SIZE_PX + SIZE_RANGE_PX (smaller reads as farther away). */
export const MIN_SIZE_PX = 4.5;
export const SIZE_RANGE_PX = 7.5;
export const MIN_DURATION_S = 9;
export const DURATION_RANGE_S = 10;
export const MAX_DRIFT_PX = 60;
export const MIN_OPACITY = 0.5;
const SEED = 2027;
const PIXELS_PER_MEGAPIXEL = 1_000_000;

/** How many flakes for a viewport: phones get fewer than big screens, never crowded. */
export function flakeCount(width: number, height: number): number {
  const megapixels = (Math.max(0, width) * Math.max(0, height)) / PIXELS_PER_MEGAPIXEL;
  return Math.min(MAX_FLAKES, Math.round(BASE_FLAKES + FLAKES_PER_MEGAPIXEL * megapixels));
}

/** Small deterministic PRNG so the layout is stable between renders. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Flake {
  /** Percent of the viewport width. */
  left: number;
  sizePx: number;
  durationS: number;
  /** Negative: flakes are already mid-fall on first paint. */
  delayS: number;
  driftPx: number;
  opacity: number;
}

export function makeFlakes(count: number): Flake[] {
  const random = mulberry32(SEED);
  return Array.from({ length: count }, () => {
    const durationS = MIN_DURATION_S + random() * DURATION_RANGE_S;
    return {
      left: random() * 100,
      sizePx: MIN_SIZE_PX + random() * SIZE_RANGE_PX,
      durationS,
      delayS: -random() * durationS,
      driftPx: (random() * 2 - 1) * MAX_DRIFT_PX,
      opacity: MIN_OPACITY + random() * (1 - MIN_OPACITY),
    };
  });
}
