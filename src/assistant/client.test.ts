import { describe, expect, it, vi } from 'vitest';
import { askAssistant, AssistantError, MAX_HISTORY, type ChatMessage } from './client';

const URL_ = 'https://assistant.example';
const q: ChatMessage[] = [{ role: 'user', content: 'When do we fly?' }];

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

async function errorKind(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return (e as AssistantError).kind;
  }
  return 'no error';
}

describe('askAssistant', () => {
  it('posts the trimmed history and returns the reply', async () => {
    const fetchImpl = respond(200, { reply: '  Wednesday at 05:15.  ' });
    const history: ChatMessage[] = Array.from({ length: MAX_HISTORY + 4 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: `m${i}`,
    }));
    await expect(askAssistant(history, { url: URL_, fetchImpl })).resolves.toBe(
      'Wednesday at 05:15.',
    );
    const [calledUrl, init] = fetchImpl.mock.calls[0]!;
    expect(calledUrl).toBe(`${URL_}/chat`);
    expect(JSON.parse(init.body).messages).toHaveLength(MAX_HISTORY);
  });

  it('maps statuses to friendly error kinds', async () => {
    expect(await errorKind(askAssistant(q, { url: URL_, fetchImpl: respond(429, {}) }))).toBe(
      'rate-limited',
    );
    expect(await errorKind(askAssistant(q, { url: URL_, fetchImpl: respond(503, {}) }))).toBe(
      'quota',
    );
    expect(await errorKind(askAssistant(q, { url: URL_, fetchImpl: respond(413, {}) }))).toBe(
      'too-long',
    );
    expect(await errorKind(askAssistant(q, { url: URL_, fetchImpl: respond(500, {}) }))).toBe(
      'server',
    );
    expect(
      await errorKind(askAssistant(q, { url: URL_, fetchImpl: respond(200, { nope: 1 }) })),
    ).toBe('server');
  });

  it('reports offline when the request fails, and not-configured without a URL', async () => {
    const failing = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await errorKind(askAssistant(q, { url: URL_, fetchImpl: failing }))).toBe('offline');
    expect(await errorKind(askAssistant(q, { url: null }))).toBe('not-configured');
  });
});
