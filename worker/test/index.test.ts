import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '../src/cache';
import { handleRequest, parseMessages, type Env } from '../src/index';
import { MAX_MESSAGE_CHARS, MAX_MESSAGES } from '../src/limits';
import { buildSystemPrompt } from '../src/prompt';

const ORIGIN = 'https://ofekfa.github.io';

function makeEnv(overrides: Partial<Env> = {}): Env & { AI: { run: ReturnType<typeof vi.fn> } } {
  return {
    AI: { run: vi.fn().mockResolvedValue({ response: 'We fly home on Sunday night.' }) },
    RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
    ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
    MODEL: '@cf/test/model',
    ...overrides,
  } as Env & { AI: { run: ReturnType<typeof vi.fn> } };
}

function chat(body: unknown, init: { origin?: string | null; method?: string } = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '1.2.3.4',
  });
  if (init.origin !== null) headers.set('Origin', init.origin ?? ORIGIN);
  return new Request('https://worker.example/chat', {
    method: init.method ?? 'POST',
    headers,
    body: init.method === 'OPTIONS' || init.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

const ask = (content: string) => ({ messages: [{ role: 'user', content }] });

// Chat builds a live-data block from upstream sources; keep tests offline (every source fails).
beforeEach(() => {
  clearMemoryCache();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
});
afterEach(() => vi.unstubAllGlobals());

describe('worker /chat', () => {
  it('answers allowed origins with CORS headers', async () => {
    const env = makeEnv();
    const res = await handleRequest(chat(ask('When do we land back home?')), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(await res.json()).toEqual({ reply: 'We fly home on Sunday night.' });
    const [model, input] = env.AI.run.mock.calls[0]!;
    expect(model).toBe('@cf/test/model');
    expect(input.messages[0].role).toBe('system');
    expect(input.messages.at(-1)).toEqual({ role: 'user', content: 'When do we land back home?' });
  });

  it('handles CORS preflight', async () => {
    const res = await handleRequest(chat(null, { method: 'OPTIONS' }), makeEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('rejects disallowed or missing origins with 403', async () => {
    const env = makeEnv();
    expect(
      (await handleRequest(chat(ask('hi'), { origin: 'https://evil.example' }), env)).status,
    ).toBe(403);
    expect((await handleRequest(chat(ask('hi'), { origin: null }), env)).status).toBe(403);
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it('rate-limits per IP with 429', async () => {
    const env = makeEnv({ RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) } });
    const res = await handleRequest(chat(ask('hi')), env);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it('rejects over-long input with 413 before calling the model', async () => {
    const env = makeEnv();
    const res = await handleRequest(chat(ask('x'.repeat(MAX_MESSAGE_CHARS + 1))), env);
    expect(res.status).toBe(413);
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it('rejects bad methods, JSON and shapes', async () => {
    const env = makeEnv();
    expect((await handleRequest(chat(null, { method: 'GET' }), env)).status).toBe(405);
    const bad = new Request('https://worker.example/chat', {
      method: 'POST',
      headers: { Origin: ORIGIN },
      body: '{nope',
    });
    expect((await handleRequest(bad, env)).status).toBe(400);
    expect(
      (await handleRequest(chat({ messages: [{ role: 'system', content: 'x' }] }), env)).status,
    ).toBe(400);
  });

  it('maps an exhausted AI quota to 503 and other failures to 502', async () => {
    const quota = makeEnv({
      AI: {
        run: vi.fn().mockRejectedValue(new Error('daily free allocation of neurons exceeded')),
      },
    });
    expect((await handleRequest(chat(ask('hi')), quota)).status).toBe(503);
    const broken = makeEnv({ AI: { run: vi.fn().mockRejectedValue(new Error('boom')) } });
    expect((await handleRequest(chat(ask('hi')), broken)).status).toBe(502);
  });

  it('serves a health check and 404s elsewhere', async () => {
    const env = makeEnv();
    expect((await handleRequest(new Request('https://worker.example/health'), env)).status).toBe(
      200,
    );
    expect((await handleRequest(new Request('https://worker.example/'), env)).status).toBe(404);
  });
});

describe('parseMessages', () => {
  it('keeps only the most recent messages', () => {
    const many = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
    }));
    many.push({ role: 'user', content: 'last' });
    const result = parseMessages({ messages: many });
    expect('messages' in result && result.messages).toHaveLength(MAX_MESSAGES);
  });

  it('requires the last message to come from the user', () => {
    expect(parseMessages({ messages: [{ role: 'assistant', content: 'hi' }] })).toMatchObject({
      status: 400,
    });
  });
});

describe('system prompt', () => {
  it('contains the trip facts in local airport times', () => {
    const prompt = buildSystemPrompt(new Date('2026-10-22T00:00:00Z'));
    expect(prompt).toContain('LY5110');
    expect(prompt).toContain('23:55');
    expect(prompt).toContain('00:35');
    expect(prompt).toContain('09:50');
    expect(prompt).toContain('Marco Polo');
    expect(prompt).toContain('2026-10-22');
    expect(prompt).toContain('You have no live data');
    expect(prompt).not.toContain('Live data (');
  });
});
