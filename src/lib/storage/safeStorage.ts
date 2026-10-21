/**
 * Key/value storage that never throws. localStorage can be missing or throw
 * (private mode, blocked site data, quota), so every access is guarded and we
 * fall back to an in-memory map for the current session.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const STORAGE_PREFIX = 'gudauri2027:';

export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
  };
}

export function createSafeStore(
  getBacking: () => Storage | undefined = () => globalThis.localStorage,
): KeyValueStore {
  const memory = createMemoryStore();
  const backing = (): Storage | undefined => {
    try {
      return getBacking();
    } catch {
      return undefined;
    }
  };
  return {
    get(key) {
      try {
        const store = backing();
        if (store) return store.getItem(STORAGE_PREFIX + key);
      } catch {
        /* fall through to memory */
      }
      return memory.get(key);
    },
    set(key, value) {
      memory.set(key, value);
      try {
        backing()?.setItem(STORAGE_PREFIX + key, value);
      } catch {
        /* memory copy keeps the session working */
      }
    },
    remove(key) {
      memory.remove(key);
      try {
        backing()?.removeItem(STORAGE_PREFIX + key);
      } catch {
        /* ignore */
      }
    },
  };
}

export const appStore = createSafeStore();
