import type { TravelerId } from '../../data/trip';
import type { KeyValueStore } from '../storage/safeStorage';
import { validateState } from './importExport';
import { createEmptyState, type PackingState } from './model';

/**
 * Persistence boundary for packing lists. Async so a shared backend
 * (e.g. the Phase 6 worker) can implement the same interface later.
 */
export interface PackingRepository {
  load(): Promise<PackingState>;
  save(state: PackingState): Promise<void>;
}

export const PACKING_STORAGE_KEY = 'packing';

export function createLocalPackingRepository(
  store: KeyValueStore,
  travelers: readonly TravelerId[],
): PackingRepository {
  return {
    async load() {
      const raw = store.get(PACKING_STORAGE_KEY);
      if (!raw) return createEmptyState(travelers);
      try {
        const result = validateState(JSON.parse(raw), travelers);
        return result.ok ? result.state : createEmptyState(travelers);
      } catch {
        return createEmptyState(travelers);
      }
    },
    async save(state) {
      store.set(PACKING_STORAGE_KEY, JSON.stringify(state));
    },
  };
}
