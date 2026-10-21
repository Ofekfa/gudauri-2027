/**
 * Versioned JSON stores with forward migrations. The version lives inline in the
 * stored object (`{ version: n, ... }`), matching the existing packing format.
 */
import type { KeyValueStore } from './safeStorage';

export interface VersionedSpec<T> {
  key: string;
  /** Current schema version. */
  version: number;
  /** migrations[n] upgrades raw data from version n to n + 1. */
  migrations?: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>;
  /** Validates data at the current version; null if unusable. */
  validate(raw: unknown): T | null;
  empty(): T;
}

export type LoadStatus = 'empty' | 'ok' | 'migrated' | 'corrupt' | 'future';

export interface LoadResult<T> {
  value: T;
  status: LoadStatus;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function loadVersioned<T>(store: KeyValueStore, spec: VersionedSpec<T>): LoadResult<T> {
  const text = store.get(spec.key);
  if (text === null) return { value: spec.empty(), status: 'empty' };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { value: spec.empty(), status: 'corrupt' };
  }
  if (!isRecord(raw) || typeof raw.version !== 'number') {
    return { value: spec.empty(), status: 'corrupt' };
  }
  // Written by a newer build: don't guess, start empty (the caller may avoid saving over it).
  if (raw.version > spec.version) return { value: spec.empty(), status: 'future' };

  let current: Record<string, unknown> = raw;
  let migrated = false;
  for (let v = raw.version; v < spec.version; v++) {
    const step = spec.migrations?.[v];
    if (!step) return { value: spec.empty(), status: 'corrupt' };
    current = { ...step(current), version: v + 1 };
    migrated = true;
  }

  const value = spec.validate(current);
  if (value === null) return { value: spec.empty(), status: 'corrupt' };
  return { value, status: migrated ? 'migrated' : 'ok' };
}

/** `data` must already carry `version: spec.version`. */
export function saveVersioned<T extends { version: number }>(
  store: KeyValueStore,
  spec: Pick<VersionedSpec<T>, 'key' | 'version'>,
  data: T,
): void {
  if (data.version !== spec.version) {
    throw new Error(`Refusing to save ${spec.key} v${data.version}; expected v${spec.version}`);
  }
  store.set(spec.key, JSON.stringify(data));
}
