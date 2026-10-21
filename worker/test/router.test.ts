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
const handle = createRouter([dataRoute, publicRoute]);

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
