import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { json } from '../src/http';
import { createRouter, type Route } from '../src/router';

const ORIGIN = 'https://ofekfa.github.io';

const env = (overrides: Partial<Env> = {}): Env => ({
  AI: { run: vi.fn() },
  ALLOWED_ORIGINS: ORIGIN,
  MODEL: 'm',
  ...overrides,
});

const dataRoute: Route = {
  method: 'GET',
  path: '/data',
  rateLimit: 'RL_DATA',
  handler: async ({ cors }) => json(200, { ok: 1 }, cors),
};
const publicRoute: Route = {
  method: 'GET',
  path: '/public',
  public: true,
  handler: async () => json(200, { pub: 1 }),
};
const itemGet: Route = {
  method: 'GET',
  path: '/things/:id/parts/:part',
  handler: async ({ params, cors }) => json(200, params, cors),
};
const itemDelete: Route = {
  method: 'DELETE',
  path: '/things/:id/parts/:part',
  handler: async ({ params, cors }) => json(200, { deleted: params.id }, cors),
};
const handle = createRouter([dataRoute, publicRoute, itemGet, itemDelete]);

const req = (path: string, init: { method?: string; origin?: string | null } = {}) => {
  const headers = new Headers({ 'CF-Connecting-IP': '9.9.9.9' });
  if (init.origin !== null) headers.set('Origin', init.origin ?? ORIGIN);
  return new Request(`https://w.example${path}`, { method: init.method ?? 'GET', headers });
};

describe('router pipeline', () => {
  it('routes GET with CORS for the route method', async () => {
    const res = await handle(req('/data'), env());
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
  });

  it('404s unknown paths before checking the origin', async () => {
    expect((await handle(req('/nope', { origin: null }), env())).status).toBe(404);
  });

  it('lets public routes skip the origin check', async () => {
    expect((await handle(req('/public', { origin: null }), env())).status).toBe(200);
  });

  it('enforces the allowlist, preflight and method', async () => {
    expect((await handle(req('/data', { origin: 'https://evil.example' }), env())).status).toBe(
      403,
    );
    expect((await handle(req('/data', { method: 'OPTIONS' }), env())).status).toBe(204);
    const res = await handle(req('/data', { method: 'POST' }), env());
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, OPTIONS');
  });

  it('uses the per-route rate limiter keyed by client IP', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const chatLimit = vi.fn().mockResolvedValue({ success: true });
    const res = await handle(
      req('/data'),
      env({ RL_DATA: { limit }, RATE_LIMITER: { limit: chatLimit } }),
    );
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: '9.9.9.9' });
    expect(chatLimit).not.toHaveBeenCalled();
  });
});

describe('path parameters and several methods per path', () => {
  it('decodes :params and picks the route by method', async () => {
    const got = await handle(req('/things/a%20b/parts/7'), env());
    expect(await got.json()).toEqual({ id: 'a b', part: '7' });
    const del = await handle(req('/things/x/parts/1', { method: 'DELETE' }), env());
    expect(await del.json()).toEqual({ deleted: 'x' });
  });

  it('advertises every method of the path in preflights and 405s', async () => {
    const pre = await handle(req('/things/x/parts/1', { method: 'OPTIONS' }), env());
    expect(pre.headers.get('Access-Control-Allow-Methods')).toBe('GET, DELETE, OPTIONS');
    const wrong = await handle(req('/things/x/parts/1', { method: 'PUT' }), env());
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get('Allow')).toBe('GET, DELETE, OPTIONS');
  });

  it('does not match partial or deeper paths, and rejects bad encoding', async () => {
    expect((await handle(req('/things/x/parts'), env())).status).toBe(404);
    expect((await handle(req('/things/x/parts/1/more'), env())).status).toBe(404);
    expect((await handle(req('/things/%E0%A4%A/parts/1'), env())).status).toBe(400);
  });
});
