/** Exponential backoff with jitter, shared by background queues (album uploads, game scores). */

export const BASE_BACKOFF_MS = 2_000;
export const MAX_BACKOFF_MS = 5 * 60_000;
const JITTER = 0.25;

/** Delay before retry number `attempts` (1, 2, 3…), with ±25% jitter from `random`. */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  return Math.round(base * (1 - JITTER + random() * 2 * JITTER));
}
