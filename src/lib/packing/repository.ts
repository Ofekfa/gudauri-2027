import type { TravelerId } from '../../data/trip';
import type { KeyValueStore } from '../storage/safeStorage';
import { validateState } from './importExport';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';
import { createEmptyState, STATE_VERSION, type PackingState } from './model';

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
  const spec: VersionedSpec<PackingState> = {
    key: PACKING_STORAGE_KEY,
    version: STATE_VERSION,
    validate: (raw) => {
      const result = validateState(raw, travelers);
      return result.ok ? result.state : null;
    },
    empty: () => createEmptyState(travelers),
  };
  return {
    async load() {
      return loadVersioned(store, spec).value;
    },
    async save(state) {
      saveVersioned(store, spec, state);
    },
  };
}
