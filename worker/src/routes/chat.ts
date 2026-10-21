import {
  MAX_BODY_BYTES,
  MAX_MESSAGE_CHARS,
  MAX_MESSAGES,
  MAX_OUTPUT_TOKENS,
  TEMPERATURE,
} from '../limits';
import { errorJson, json } from '../http';
import { buildSystemPrompt } from '../prompt';
import type { Route } from '../router';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Returns validated messages or an error description. */
export function parseMessages(
  body: unknown,
): { messages: ChatMessage[] } | { error: string; status: number } {
  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as { messages?: unknown }).messages)
  ) {
    return { error: 'Expected { messages: [...] }', status: 400 };
  }
  const raw = (body as { messages: unknown[] }).messages;
  if (raw.length === 0) return { error: 'No messages', status: 400 };
  const messages: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (typeof m !== 'object' || m === null) return { error: 'Invalid message', status: 400 };
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return { error: 'Invalid message', status: 400 };
    }
    const text = content.trim();
    if (!text) return { error: 'Empty message', status: 400 };
    // Assistant turns are our own earlier replies; only user input is strictly capped.
    if (role === 'user' && text.length > MAX_MESSAGE_CHARS) {
      return { error: `Messages are limited to ${MAX_MESSAGE_CHARS} characters`, status: 413 };
    }
    messages.push({ role, content: text.slice(0, MAX_MESSAGE_CHARS * 2) });
  }
  if (messages[messages.length - 1]!.role !== 'user') {
    return { error: 'The last message must be from the user', status: 400 };
  }
  return { messages };
}

function extractReply(result: unknown): string | null {
  if (typeof result === 'object' && result !== null && 'response' in result) {
    const response = (result as { response: unknown }).response;
    if (typeof response === 'string' && response.trim()) return response.trim();
  }
  return null;
}

/** Workers AI signals an exhausted free allowance with a "daily free allocation" style error. */
const isQuotaError = (err: unknown) => /neuron|allocation|quota|limit/i.test(String(err));

export const chatRoute: Route = {
  method: 'POST',
  path: '/chat',
  rateLimit: 'RATE_LIMITER',
  async handler({ request, env, cors, now }) {
    const length = Number(request.headers.get('Content-Length') ?? '0');
    if (length > MAX_BODY_BYTES) return errorJson(413, 'Request too large', cors);
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return errorJson(413, 'Request too large', cors);

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return errorJson(400, 'Invalid JSON', cors);
    }
    const parsed = parseMessages(body);
    if ('error' in parsed) return errorJson(parsed.status, parsed.error, cors);

    try {
      const result = await env.AI.run(env.MODEL, {
        messages: [{ role: 'system', content: buildSystemPrompt(now) }, ...parsed.messages],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
      });
      const reply = extractReply(result);
      if (!reply) return errorJson(502, 'Empty answer from the model', cors);
      return json(200, { reply }, cors);
    } catch (err) {
      if (isQuotaError(err)) return errorJson(503, 'Daily AI quota used up', cors);
      return errorJson(502, 'The AI model is unavailable', cors);
    }
  },
};
