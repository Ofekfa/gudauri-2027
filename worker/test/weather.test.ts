import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '../src/cache';
import type { Env, KvLike } from '../src/env';
import { handleRequest } from '../src/index';
import { WEATHER_CACHE_KEY } from '../src/routes/weather';
import realResponse from './fixtures/open-meteo-2026-10-22.json';

const ORIGIN = 'https://ofekfa.github.io';
/** A real Open-Meteo response for our three zones (captured 2026-10-22). */
const REAL = JSON.stringify(realResponse);

function fakeKv(): KvLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: async (k) => data.get(k) ?? null, put: async (k, v) => void data.set(k, v) };
}
const env = (kv = fakeKv()): Env => ({
  AI: { run: vi.fn() },
  RL_DATA: { limit: vi.fn().mockResolvedValue({ success: true }) },
  CACHE: kv,
  ALLOWED_ORIGINS: ORIGIN,
  MODEL: 'm',
});
const get = (e: Env) =>
  handleRequest(new Request('https://w.example/weather', { headers: { Origin: ORIGIN } }), e);
const stubFetch = (body: string, status = 200) => {
  const fn = vi.fn(async (_input: RequestInfo | URL) => new Response(body, { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
};

beforeEach(() => clearMemoryCache());
afterEach(() => vi.unstubAllGlobals());

describe('GET /weather', () => {
  it('summarizes a real Open-Meteo response per zone, in one upstream call', async () => {
    const fetchMock = stubFetch(REAL);
    const res = await get(env());
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('elevation=2000%2C2700%2C2950');
    const body = (await res.json()) as {
      source: string;
      stale: boolean;
      zones: {
        id: string;
        days: unknown[];
        snowDepthCm: number | null;
        current: { tempC: number };
      }[];
    };
    expect(body.source).toBe('open-meteo');
    expect(body.zones.map((z) => z.id)).toEqual(['base', 'mid', 'top']);
    expect(body.zones[0]!.days.length).toBeGreaterThanOrEqual(6);
    // Higher is colder.
    expect(body.zones[2]!.current.tempC).toBeLessThan(body.zones[0]!.current.tempC);
    expect(body.zones.every((z) => z.snowDepthCm === null || z.snowDepthCm >= 0)).toBe(true);
    // Compact: far smaller than the 70 kB upstream response.
    expect(JSON.stringify(body).length).toBeLessThan(5000);
  });

  it('falls back to stale data when Open-Meteo fails', async () => {
    const kv = fakeKv();
    stubFetch(REAL);
    await get(env(kv));
    const entry = JSON.parse(kv.data.get(WEATHER_CACHE_KEY)!);
    entry.fetchedAt -= 2 * 60 * 60_000;
    kv.data.set(WEATHER_CACHE_KEY, JSON.stringify(entry));
    clearMemoryCache();
    stubFetch('{"error":true,"reason":"rate limit"}', 429);
    const res = await get(env(kv));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { stale: boolean }).stale).toBe(true);
  });

  it('rejects malformed upstream data with 503 when nothing is cached', async () => {
    stubFetch(JSON.stringify([{ elevation: 2000 }]));
    expect((await get(env())).status).toBe(503);
  });

  it('enforces origin and method', async () => {
    stubFetch(REAL);
    const evil = await handleRequest(
      new Request('https://w.example/weather', { headers: { Origin: 'https://evil.example' } }),
      env(),
    );
    expect(evil.status).toBe(403);
    const post = await handleRequest(
      new Request('https://w.example/weather', { method: 'POST', headers: { Origin: ORIGIN } }),
      env(),
    );
    expect(post.status).toBe(405);
  });
});
