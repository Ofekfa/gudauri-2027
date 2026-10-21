/** Pure logic for occasional fun-fact pop-ups. Time and randomness are injected for tests. */

export type Random = () => number;

/**
 * Shuffle bag: every item comes out once per cycle in random order, and the
 * first item of a new cycle is never the last item of the previous one.
 */
export function createShuffleBag<T>(items: readonly T[], random: Random = Math.random) {
  if (items.length === 0) throw new Error('Shuffle bag needs at least one item');
  let bag: T[] = [];
  let last: T | undefined;

  const refill = () => {
    bag = [...items];
    // Fisher–Yates
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j]!, bag[i]!];
    }
    // bag is consumed from the end; avoid an immediate repeat across cycles.
    if (bag.length > 1 && bag[bag.length - 1] === last) {
      [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!];
    }
  };

  return {
    next(): T {
      if (bag.length === 0) refill();
      last = bag.pop()!;
      return last;
    },
  };
}

export const FIRST_FACT_DELAY_MS = 20_000;
/** Never more often than this… */
export const MIN_FACT_INTERVAL_MS = 45_000;
/** …plus up to this much random extra, so pop-ups feel occasional rather than clockwork. */
export const FACT_INTERVAL_JITTER_MS = 45_000;
export const FACT_TOAST_MS = 12_000;

export function nextFactDueAt(shownAt: number, random: Random = Math.random): number {
  return shownAt + MIN_FACT_INTERVAL_MS + random() * FACT_INTERVAL_JITTER_MS;
}

export interface FactGate {
  now: number;
  dueAt: number;
  muted: boolean;
  pageHidden: boolean;
  /** e.g. while playing the game, a pop-up would be in the way. */
  routeBlocked: boolean;
}

export function shouldShowFact({ now, dueAt, muted, pageHidden, routeBlocked }: FactGate): boolean {
  return !muted && !pageHidden && !routeBlocked && now >= dueAt;
}

/**
 * When the site opens: respect the interval since the last pop-up (even across
 * reloads), but never sooner than the first-fact delay.
 */
export function initialFactDueAt(now: number, lastShownAt: number | null): number {
  const earliest = now + FIRST_FACT_DELAY_MS;
  return lastShownAt === null ? earliest : Math.max(earliest, lastShownAt + MIN_FACT_INTERVAL_MS);
}
