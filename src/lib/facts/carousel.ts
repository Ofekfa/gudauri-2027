/** Pure helpers for the one-fact-at-a-time viewer. */

/** Wraps any integer into 0..length-1 (so "previous" from the first goes to the last). */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export type SwipeDirection = 'next' | 'previous';

/** Minimum horizontal travel (CSS px) for a swipe. */
export const SWIPE_MIN_DISTANCE_PX = 50;
/** Horizontal travel must dominate vertical travel by this factor, so scrolling isn't a swipe. */
export const SWIPE_DIRECTION_RATIO = 1.5;

/** Swiping left (finger moves left) shows the next fact, like turning a page. */
export function detectSwipe(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return null;
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_DIRECTION_RATIO) return null;
  return dx < 0 ? 'next' : 'previous';
}

export function keyToDirection(key: string): SwipeDirection | null {
  if (key === 'ArrowRight') return 'next';
  if (key === 'ArrowLeft') return 'previous';
  return null;
}
