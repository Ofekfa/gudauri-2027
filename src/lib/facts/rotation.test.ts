import { describe, expect, it } from 'vitest';
import {
  createShuffleBag,
  FIRST_FACT_DELAY_MS,
  initialFactDueAt,
  MIN_FACT_INTERVAL_MS,
  FACT_INTERVAL_JITTER_MS,
  nextFactDueAt,
  shouldShowFact,
} from './rotation';

/** Deterministic PRNG for tests. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('createShuffleBag', () => {
  it('returns every item exactly once per cycle', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const bag = createShuffleBag(items, seeded(42));
    for (let cycle = 0; cycle < 3; cycle++) {
      const drawn = items.map(() => bag.next());
      expect([...drawn].sort()).toEqual(items);
    }
  });

  it('never repeats the same item back-to-back across cycles', () => {
    const bag = createShuffleBag([1, 2, 3], seeded(7));
    let previous = bag.next();
    for (let i = 0; i < 300; i++) {
      const current = bag.next();
      expect(current).not.toBe(previous);
      previous = current;
    }
  });

  it('works with a single item', () => {
    const bag = createShuffleBag(['only']);
    expect([bag.next(), bag.next()]).toEqual(['only', 'only']);
  });
});

describe('scheduling', () => {
  const base = { now: 1000, dueAt: 1000, muted: false, pageHidden: false, routeBlocked: false };

  it('shows only when due, unmuted, visible and not blocked', () => {
    expect(shouldShowFact(base)).toBe(true);
    expect(shouldShowFact({ ...base, now: 999 })).toBe(false);
    expect(shouldShowFact({ ...base, muted: true })).toBe(false);
    expect(shouldShowFact({ ...base, pageHidden: true })).toBe(false);
    expect(shouldShowFact({ ...base, routeBlocked: true })).toBe(false);
  });

  it('keeps at least the minimum interval between pop-ups', () => {
    expect(nextFactDueAt(0, () => 0)).toBe(MIN_FACT_INTERVAL_MS);
    expect(nextFactDueAt(0, () => 0.999)).toBeLessThan(
      MIN_FACT_INTERVAL_MS + FACT_INTERVAL_JITTER_MS,
    );
  });

  it('waits the first-fact delay on a fresh visit', () => {
    expect(initialFactDueAt(0, null)).toBe(FIRST_FACT_DELAY_MS);
  });

  it('respects the interval across reloads', () => {
    const now = 100_000;
    expect(initialFactDueAt(now, now - 5_000)).toBe(now - 5_000 + MIN_FACT_INTERVAL_MS);
    expect(initialFactDueAt(now, now - 10 * MIN_FACT_INTERVAL_MS)).toBe(now + FIRST_FACT_DELAY_MS);
  });
});
