import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '../src/cache';
import type { Env, KvLike } from '../src/env';
import { handleRequest } from '../src/index';
import { ER_API_URL, NBG_URL, RATES_CACHE_KEY } from '../src/routes/rates';

const ORIGIN = 'https://ofekfa.github.io';
const NBG_BODY = [
  {
    date: '2026-10-22T00:00:00.000Z',
    currencies: [
      { code: 'ILS', quantity: 10, rate: 8.3994, validFromDate: '2026-10-22T00:00:00.000Z' },
      { code: 'EUR', quantity: 1, rate: 2.9163, validFromDate: '2026-10-22T00:00:00.000Z' },
    ],
  },
];
const ER_BODY = {
  result: 'success',
  time_last_update_unix: 1792540801,
  rates: { ILS: 1.19, EUR: 0.343 },
};

function fakeKv(): KvLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: async (k) => data.get(k) ?? null, put: async (k, v) => void data.set(k, v) };
}

function env(kv = fakeKv()): Env {
  return {
    AI: { run: vi.fn() },
    RL_DATA: { limit: vi.fn().mockResolvedValue({ success: true }) },
    CACHE: kv,
    ALLOWED_ORIGINS: ORIGIN,
    MODEL: 'm',
  };
}

function mockUpstreams(responses: Record<string, unknown | Error>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = responses[url];
    if (body === undefined || body instanceof Error) throw body ?? new Error(`unexpected ${url}`);
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const get = (e: Env, origin = ORIGIN) =>
  handleRequest(
    new Request('https://w.example/rates', {
      headers: { Origin: origin, 'CF-Connecting-IP': '1.1.1.1' },
    }),
    e,
  );

beforeEach(() => clearMemoryCache());
afterEach(() => vi.unstubAllGlobals());

describe('GET /rates', () => {
  it('serves NBG rates normalized per unit, with CORS and browser caching', async () => {
    mockUpstreams({ [NBG_URL]: NBG_BODY });
    const res = await get(env());
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(res.headers.get('Cache-Control')).toMatch(/max-age=\d+/);
    expect(await res.json()).toMatchObject({
      base: 'GEL',
      gelPer: { ILS: 0.83994, EUR: 2.9163 },
      validFrom: '2026-10-22',
      source: 'nbg',
      stale: false,
    });
  });

  it('falls back to ExchangeRate-API when NBG fails', async () => {
    mockUpstreams({ [NBG_URL]: new Error('down'), [ER_API_URL]: ER_BODY });
    const body = (await (await get(env())).json()) as { source: string };
    expect(body.source).toBe('er-api');
  });

  it('caches in KV and serves stale data when every upstream fails', async () => {
    const kv = fakeKv();
    mockUpstreams({ [NBG_URL]: NBG_BODY });
    await get(env(kv));
    expect(kv.data.has(RATES_CACHE_KEY)).toBe(true);
    // Age the stored entry past the 12 h TTL (but within max-stale), then break both upstreams.
    const entry = JSON.parse(kv.data.get(RATES_CACHE_KEY)!);
    entry.fetchedAt -= 13 * 60 * 60 * 1000;
    kv.data.set(RATES_CACHE_KEY, JSON.stringify(entry));
    clearMemoryCache();
    mockUpstreams({ [NBG_URL]: new Error('down'), [ER_API_URL]: new Error('down') });
    const res = await get(env(kv));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ source: 'nbg', stale: true });
  });

  it('serves fresh cache without calling upstream', async () => {
    const kv = fakeKv();
    mockUpstreams({ [NBG_URL]: NBG_BODY });
    await get(env(kv));
    clearMemoryCache();
    const fetchMock = mockUpstreams({});
    expect((await get(env(kv))).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 when nothing usable exists (garbage upstreams, empty cache)', async () => {
    mockUpstreams({ [NBG_URL]: { nonsense: true }, [ER_API_URL]: { result: 'error' } });
    const res = await get(env());
    expect(res.status).toBe(503);
  });

  it('rejects other origins and non-GET methods', async () => {
    mockUpstreams({ [NBG_URL]: NBG_BODY });
    expect((await get(env(), 'https://evil.example')).status).toBe(403);
    const post = await handleRequest(
      new Request('https://w.example/rates', { method: 'POST', headers: { Origin: ORIGIN } }),
      env(),
    );
    expect(post.status).toBe(405);
  });
});
