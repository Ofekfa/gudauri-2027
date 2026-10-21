import { describe, expect, it } from 'vitest';
import { createSafeStore, STORAGE_PREFIX } from './safeStorage';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe('createSafeStore', () => {
  it('reads and writes through to the backing storage with a prefix', () => {
    const backing = fakeStorage();
    const store = createSafeStore(() => backing);
    store.set('a', '1');
    expect(backing.getItem(`${STORAGE_PREFIX}a`)).toBe('1');
    expect(store.get('a')).toBe('1');
  });

  it('falls back to memory when storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    const store = createSafeStore(() => throwing);
    store.set('a', '1');
    expect(store.get('a')).toBe('1');
    store.remove('a');
    expect(store.get('a')).toBeNull();
  });

  it('works when storage is unavailable entirely', () => {
    const store = createSafeStore(() => {
      throw new Error('SecurityError');
    });
    store.set('k', 'v');
    expect(store.get('k')).toBe('v');
  });
});
