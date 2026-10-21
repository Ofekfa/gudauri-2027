import { appStore, type KeyValueStore } from '../storage/safeStorage';

const MUTED_KEY = 'facts:muted';
const LAST_SHOWN_KEY = 'facts:lastShownAt';

type Listener = (muted: boolean) => void;

/** Fun-fact preferences, persisted via safe storage and observable by the UI. */
export function createFactSettings(store: KeyValueStore) {
  const listeners = new Set<Listener>();
  return {
    isMuted: () => store.get(MUTED_KEY) === 'true',
    setMuted(muted: boolean) {
      store.set(MUTED_KEY, String(muted));
      listeners.forEach((l) => l(muted));
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    lastShownAt(): number | null {
      const value = Number(store.get(LAST_SHOWN_KEY));
      return Number.isFinite(value) && value > 0 ? value : null;
    },
    recordShown(at: number) {
      store.set(LAST_SHOWN_KEY, String(at));
    },
  };
}

export const factSettings = createFactSettings(appStore);
