import type { Random } from './engine';

/** Seedable PRNG (mulberry32): the same seed always plays the same slope. */
export function createRng(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A fresh seed per run. */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}
