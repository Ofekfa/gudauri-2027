import { describe, expect, it, vi } from 'vitest';
import {
  getOrRefresh,
  kvStore,
  layeredStore,
  memoryStore,
  UpstreamUnavailableError,
} from '../src/cache';
import type { KvLike } from '../src/env';

const policy = { ttlMs: 1000, maxStaleMs: 10_000 };
const validateNumber = (raw: unknown) => {
  if (typeof raw !== 'number') throw new Error('bad payload');
  return raw;
};

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('getOrRefresh', () => {
  it('fetches once, then serves from cache while fresh', async () => {
    const store = memoryStore();
    const c = clock();
    const fetcher = vi.fn().mockResolvedValue(42);
    const a = await getOrRefresh(store, 'k', policy, fetcher, validateNumber, c.now);
    c.advance(500);
    const b = await getOrRefresh(store, 'k', policy, fetcher, validateNumber, c.now);
    expect([a.data, b.data, b.stale]).toEqual([42, 42, false]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches after the TTL', async () => {
    const store = memoryStore();
    const c = clock();
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await getOrRefresh(store, 'k', policy, fetcher, validateNumber, c.now);
    c.advance(1500);
    const r = await getOrRefresh(store, 'k', policy, fetcher, validateNumber, c.now);
    expect(r).toMatchObject({ data: 2, stale: false, fetchedAt: 1500 });
  });

  it('serves stale data when the upstream fails or returns garbage', async () => {
    const store = memoryStore();
    const c = clock();
    await getOrRefresh(store, 'k', policy, async () => 7, validateNumber, c.now);
    c.advance(5000);
    const failed = await getOrRefresh(
      store,
      'k',
      policy,
      () => Promise.reject(new Error('down')),
      validateNumber,
      c.now,
    );
    expect(failed).toMatchObject({ data: 7, stale: true, fetchedAt: 0 });
    const garbage = await getOrRefresh(
      store,
      'k',
      policy,
      async () => 'nope',
      validateNumber,
      c.now,
    );
    expect(garbage.stale).toBe(true);
  });

  it('throws when there is nothing usable', async () => {
    const store = memoryStore();
    const c = clock();
    await expect(
      getOrRefresh(
        store,
        'k',
        policy,
        () => Promise.reject(new Error('down')),
        validateNumber,
        c.now,
      ),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
    await getOrRefresh(store, 'k', policy, async () => 1, validateNumber, c.now);
    c.advance(20_000);
    await expect(
      getOrRefresh(
        store,
        'k',
        policy,
        () => Promise.reject(new Error('down')),
        validateNumber,
        c.now,
      ),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });
});

describe('stores', () => {
  function fakeKv(): KvLike & { data: Map<string, string>; ttls: number[] } {
    const data = new Map<string, string>();
    const ttls: number[] = [];
    return {
      data,
      ttls,
      get: async (k) => data.get(k) ?? null,
      put: async (k, v, o) => {
        data.set(k, v);
        if (o?.expirationTtl) ttls.push(o.expirationTtl);
      },
    };
  }

  it('KV store round-trips JSON with a TTL of at least 60 s and tolerates failures', async () => {
    const kv = fakeKv();
    const store = kvStore(kv);
    await store.put('a', { data: { x: 1 }, fetchedAt: 5 }, 10);
    expect(await store.get('a')).toEqual({ data: { x: 1 }, fetchedAt: 5 });
    expect(kv.ttls).toEqual([60]);
    const broken = kvStore({
      get: () => Promise.reject(new Error('x')),
      put: () => Promise.reject(new Error('x')),
    });
    await expect(broken.put('a', { data: 1, fetchedAt: 0 }, 1000)).resolves.toBeUndefined();
    expect(await broken.get('a')).toBeNull();
  });

  it('layered store reads through to KV and warms memory', async () => {
    const kv = fakeKv();
    const memory = memoryStore();
    await kvStore(kv).put('k', { data: 'v', fetchedAt: 1 }, 60_000);
    const store = layeredStore(memory, kvStore(kv));
    expect(await store.get('k')).toEqual({ data: 'v', fetchedAt: 1 });
    kv.data.clear();
    expect(await store.get('k')).toEqual({ data: 'v', fetchedAt: 1 });
  });
});
