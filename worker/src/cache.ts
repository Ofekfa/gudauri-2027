/**
 * Read-through cache with stale-on-error for upstream data (rates, weather, calendar).
 * Backed by KV when the CACHE binding exists, with a per-isolate memory layer in front.
 * (The Cache API is only documented as functional on custom domains, not workers.dev.)
 */
import type { KvLike } from './env';

export interface CacheEntry<T> {
  data: T;
  /** Epoch ms when the upstream data was fetched. */
  fetchedAt: number;
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  put<T>(key: string, entry: CacheEntry<T>, keepForMs: number): Promise<void>;
}

const MS_PER_S = 1000;
/** KV's minimum expirationTtl. */
const KV_MIN_TTL_S = 60;

export function memoryStore(): CacheStore & { clear(): void } {
  const map = new Map<string, { entry: CacheEntry<unknown>; expiresAt: number }>();
  return {
    clear: () => map.clear(),
    async get<T>(key: string) {
      const hit = map.get(key);
      if (!hit || hit.expiresAt < Date.now()) return null;
      return hit.entry as CacheEntry<T>;
    },
    async put(key, entry, keepForMs) {
      map.set(key, { entry, expiresAt: Date.now() + keepForMs });
    },
  };
}

export function kvStore(kv: KvLike): CacheStore {
  return {
    async get<T>(key: string) {
      try {
        const raw = await kv.get(key);
        return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
      } catch {
        return null;
      }
    },
    async put(key, entry, keepForMs) {
      try {
        await kv.put(key, JSON.stringify(entry), {
          expirationTtl: Math.max(KV_MIN_TTL_S, Math.ceil(keepForMs / MS_PER_S)),
        });
      } catch {
        /* A failed cache write must never fail the request. */
      }
    },
  };
}

/** Memory first, then KV (warming memory on a KV hit). */
export function layeredStore(...layers: CacheStore[]): CacheStore {
  return {
    async get<T>(key: string) {
      for (let i = 0; i < layers.length; i++) {
        const hit = await layers[i]!.get<T>(key);
        if (hit) {
          for (let j = 0; j < i; j++) await layers[j]!.put(key, hit, Number.MAX_SAFE_INTEGER);
          return hit;
        }
      }
      return null;
    },
    async put(key, entry, keepForMs) {
      await Promise.all(layers.map((l) => l.put(key, entry, keepForMs)));
    },
  };
}

export interface FreshnessPolicy {
  /** Serve from cache without refetching while younger than this. */
  ttlMs: number;
  /** On upstream failure, serve cached data up to this age. */
  maxStaleMs: number;
}

export interface CachedResult<T> {
  data: T;
  fetchedAt: number;
  stale: boolean;
}

export class UpstreamUnavailableError extends Error {}

/**
 * Returns fresh cached data, or refetches and validates. If the refetch or
 * validation fails, serves stale data within `maxStaleMs`, else throws.
 */
export async function getOrRefresh<T>(
  store: CacheStore,
  key: string,
  policy: FreshnessPolicy,
  fetcher: () => Promise<unknown>,
  validate: (raw: unknown) => T,
  now: () => number = Date.now,
): Promise<CachedResult<T>> {
  const cached = await store.get<T>(key);
  const age = cached ? now() - cached.fetchedAt : Infinity;
  if (cached && age < policy.ttlMs)
    return { data: cached.data, fetchedAt: cached.fetchedAt, stale: false };

  try {
    const data = validate(await fetcher());
    const entry = { data, fetchedAt: now() };
    await store.put(key, entry, policy.maxStaleMs);
    return { ...entry, stale: false };
  } catch (err) {
    if (cached && age < policy.maxStaleMs) {
      return { data: cached.data, fetchedAt: cached.fetchedAt, stale: true };
    }
    throw new UpstreamUnavailableError(err instanceof Error ? err.message : String(err));
  }
}

/** Per-isolate memory survives between requests on the same isolate. */
const sharedMemory = memoryStore();

/** Tests only: isolates are long-lived in production, but each test needs a cold cache. */
export function clearMemoryCache(): void {
  sharedMemory.clear();
}

export function cacheStoreFor(kv: KvLike | undefined): CacheStore {
  return kv ? layeredStore(sharedMemory, kvStore(kv)) : sharedMemory;
}
