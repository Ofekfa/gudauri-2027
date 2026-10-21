import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToastStore, MAX_VISIBLE_TOASTS } from './toastStore';

describe('toast store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows and auto-dismisses after the duration', () => {
    const store = createToastStore();
    const seen: number[] = [];
    store.subscribe((t) => seen.push(t.length));
    store.show({ message: 'Hi', durationMs: 1000 });
    expect(store.getAll()).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(store.getAll()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(store.getAll()).toHaveLength(0);
    expect(seen).toEqual([1, 0]);
  });

  it('dismisses on demand', () => {
    const store = createToastStore();
    const id = store.show({ message: 'Hi' });
    store.dismiss(id);
    expect(store.getAll()).toEqual([]);
  });

  it(`keeps at most ${MAX_VISIBLE_TOASTS} toasts, dropping the oldest`, () => {
    const store = createToastStore();
    store.show({ message: 'a' });
    store.show({ message: 'b' });
    store.show({ message: 'c' });
    expect(store.getAll().map((t) => t.message)).toEqual(['b', 'c']);
  });
});
