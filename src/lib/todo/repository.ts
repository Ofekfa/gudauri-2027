import { appStore, type KeyValueStore } from '../storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';
import { validateTodoState } from './importExport';
import { createEmptyTodoState, TODO_STATE_VERSION, type TodoState } from './model';

/** Async so a shared backend could implement it later (lists are per-device today). */
export interface TodoRepository {
  load(): Promise<TodoState>;
  save(state: TodoState): Promise<void>;
}

export const TODO_STORAGE_KEY = 'todo';

const spec: VersionedSpec<TodoState> = {
  key: TODO_STORAGE_KEY,
  version: TODO_STATE_VERSION,
  validate: (raw) => validateTodoState(raw),
  empty: () => createEmptyTodoState(),
};

/** Synchronous read for first-paint UI (e.g. the Home card) so nothing shifts in later. */
export function loadTodoStateSync(store: KeyValueStore = appStore): TodoState {
  return loadVersioned(store, spec).value;
}

export function createLocalTodoRepository(store: KeyValueStore): TodoRepository {
  return {
    async load() {
      return loadTodoStateSync(store);
    },
    async save(state) {
      saveVersioned(store, spec, state);
    },
  };
}

export const defaultTodoRepository = createLocalTodoRepository(appStore);
