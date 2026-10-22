/**
 * This phone's sync membership: the group code (shared by the four of us,
 * stored only on the phone) and whose phone it is. Framework-free store.
 */
import { trip, type TravelerId } from '../../data/trip';
import { appStore, type KeyValueStore } from '../storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';

const VERSION = 1;

export interface SyncSettings {
  version: typeof VERSION;
  code: string | null;
  me: TravelerId | null;
}

const TRAVELER_IDS = trip.travelers.map((t) => t.id);

const spec: VersionedSpec<SyncSettings> = {
  key: 'sync:settings',
  version: VERSION,
  validate: (raw) => {
    const r = raw as Partial<SyncSettings> | null;
    if (!r) return null;
    const code = typeof r.code === 'string' && r.code.trim() ? r.code : null;
    const me = TRAVELER_IDS.includes(r.me as TravelerId) ? (r.me as TravelerId) : null;
    return { version: VERSION, code, me };
  },
  empty: () => ({ version: VERSION, code: null, me: null }),
};

export function createSyncSettingsStore(store: KeyValueStore = appStore) {
  let settings = loadVersioned(store, spec).value;
  const listeners = new Set<(s: SyncSettings) => void>();
  const set = (next: SyncSettings) => {
    settings = next;
    saveVersioned(store, spec, next);
    listeners.forEach((l) => l(next));
  };
  return {
    get: () => settings,
    join: (code: string, me: TravelerId) => set({ version: VERSION, code: code.trim(), me }),
    leave: () => set({ version: VERSION, code: null, me: settings.me }),
    subscribe(listener: (s: SyncSettings) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const syncSettings = createSyncSettingsStore();

/** Joined: a code and whose phone this is. */
export const isJoined = (s: SyncSettings): s is SyncSettings & { code: string; me: TravelerId } =>
  s.code !== null && s.me !== null;
