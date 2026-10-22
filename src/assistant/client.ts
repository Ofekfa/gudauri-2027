import { WORKER_URL } from '../lib/worker/config';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Mirrors the Worker's limits (worker/src/limits.ts). */
export const MAX_QUESTION_CHARS = 500;
export const MAX_HISTORY = 10;
const REQUEST_TIMEOUT_MS = 25_000;

export type AssistantErrorKind =
  'not-configured' | 'offline' | 'rate-limited' | 'quota' | 'too-long' | 'server';

export const ASSISTANT_ERROR_TEXT: Record<AssistantErrorKind, string> = {
  'not-configured': 'The assistant isn’t connected yet. Ofek still needs to finish its setup.',
  offline:
    'I couldn’t reach the assistant. It needs an internet connection; the rest of the site works offline.',
  'rate-limited': 'Whoa, lots of questions! Give me a minute and ask again.',
  quota: 'The free AI allowance for today is used up. Try again tomorrow!',
  'too-long': `That question is a bit long. Please keep it under ${MAX_QUESTION_CHARS} characters.`,
  server: 'The assistant had a hiccup. Please try again in a moment.',
};

export class AssistantError extends Error {
  constructor(public readonly kind: AssistantErrorKind) {
    super(kind);
  }
}

export function errorKindForStatus(status: number): AssistantErrorKind {
  if (status === 429) return 'rate-limited';
  if (status === 503) return 'quota';
  if (status === 413) return 'too-long';
  return 'server';
}

export const ASSISTANT_URL = WORKER_URL;

export async function askAssistant(
  history: readonly ChatMessage[],
  options: { url?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const url = options.url === undefined ? ASSISTANT_URL : options.url;
  if (!url) throw new AssistantError('not-configured');
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(`${url}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
      signal: controller.signal,
    });
  } catch {
    throw new AssistantError('offline');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new AssistantError(errorKindForStatus(response.status));
  const data = (await response.json().catch(() => null)) as { reply?: unknown } | null;
  if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new AssistantError('server');
  return data.reply.trim();
}
