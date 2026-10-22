import { describe, expect, it } from 'vitest';
import {
  BASE_FLAKES,
  flakeCount,
  makeFlakes,
  MAX_FLAKES,
  MIN_SIZE_PX,
  SIZE_RANGE_PX,
} from './flakes';

describe('snowfall flakes', () => {
  it('scales the count with viewport area: fewer on phones, more on big screens, capped', () => {
    const phone = flakeCount(390, 844);
    const laptop = flakeCount(1440, 900);
    const desktop = flakeCount(1920, 1080);
    expect(phone).toBe(42);
    expect(laptop).toBe(59);
    expect(desktop).toBe(73);
    expect(flakeCount(5120, 2880)).toBe(MAX_FLAKES);
    expect(flakeCount(0, 0)).toBe(BASE_FLAKES);
  });

  it('is about twice the old 28 flakes on a laptop, and 1.5× on a phone', () => {
    expect(flakeCount(1440, 900) / 28).toBeCloseTo(2.1, 1);
    expect(flakeCount(390, 844) / 28).toBeCloseTo(1.5, 1);
  });

  it('makes stable flakes within the size range (depth through variation)', () => {
    const flakes = makeFlakes(60);
    expect(makeFlakes(60)).toEqual(flakes);
    const sizes = flakes.map((f) => f.sizePx);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_SIZE_PX);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(MIN_SIZE_PX + SIZE_RANGE_PX);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThan(SIZE_RANGE_PX * 0.8);
    expect(flakes.every((f) => f.delayS <= 0 && f.left >= 0 && f.left <= 100)).toBe(true);
  });
});
