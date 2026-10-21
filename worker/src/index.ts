/**
 * Gudauri 2027 assistant proxy. Holds no secrets: it calls Workers AI through
 * the `AI` binding. Protection: origin allowlist + CORS, per-IP rate limit,
 * method/size/shape validation, short outputs.
 */
import {
  MAX_BODY_BYTES,
  MAX_MESSAGE_CHARS,
  MAX_MESSAGES,
  MAX_OUTPUT_TOKENS,
  TEMPERATURE,
} from './limits';
import { buildSystemPrompt } from './prompt';

export interface Env {
  AI: { run(model: string, input: unknown): Promise<unknown> };
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  ALLOWED_ORIGINS: string;
  MODEL: string;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return allowed.includes(origin) ? origin : null;
}

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

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

export async function handleRequest(
  request: Request,
  env: Env,
  now = new Date(),
): Promise<Response> {
  const url = new URL(request.url);
  const origin = allowedOrigin(request, env);

  if (url.pathname === '/health') return json(200, { ok: true });
  if (url.pathname !== '/chat') return json(404, { error: 'Not found' });
  if (!origin) return json(403, { error: 'Origin not allowed' });
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST')
    return json(405, { error: 'Use POST' }, { ...cors, Allow: 'POST, OPTIONS' });

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success)
      return json(429, { error: 'Too many requests' }, { ...cors, 'Retry-After': '60' });
  }

  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (length > MAX_BODY_BYTES) return json(413, { error: 'Request too large' }, cors);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json(413, { error: 'Request too large' }, cors);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'Invalid JSON' }, cors);
  }
  const parsed = parseMessages(body);
  if ('error' in parsed) return json(parsed.status, { error: parsed.error }, cors);

  try {
    const result = await env.AI.run(env.MODEL, {
      messages: [{ role: 'system', content: buildSystemPrompt(now) }, ...parsed.messages],
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
    });
    const reply = extractReply(result);
    if (!reply) return json(502, { error: 'Empty answer from the model' }, cors);
    return json(200, { reply }, cors);
  } catch (err) {
    if (isQuotaError(err)) return json(503, { error: 'Daily AI quota used up' }, cors);
    return json(502, { error: 'The AI model is unavailable' }, cors);
  }
}

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
} satisfies ExportedHandler<Env>;
