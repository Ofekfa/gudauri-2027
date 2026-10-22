import {
  MAX_SYNC_BODY_BYTES,
  parseSyncRequest,
  type SyncRequest,
  type SyncResponse,
} from '../../../src/lib/sync/protocol';
import { errorJson, json } from '../http';
import type { Route } from '../router';
import { TooManyRecordsError } from '../sync/recordStore';

/** One group, one object. */
const GROUP_OBJECT = 'group';
const encoder = new TextEncoder();

/** Constant-time comparison so response timing doesn't leak the code. */
export async function codeMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(given)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

export interface SyncBackend {
  sync(request: SyncRequest): Promise<SyncResponse> | SyncResponse;
}

export const syncRoute: Route = {
  method: 'POST',
  path: '/sync',
  rateLimit: 'RL_DATA',
  async handler({ request, env, cors }) {
    if (!env.GROUP_CODE || !env.LISTS) return errorJson(501, 'Sync not set up', cors);
    const auth = request.headers.get('Authorization') ?? '';
    const code = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    if (!code || !(await codeMatches(code, env.GROUP_CODE)))
      return errorJson(401, 'Wrong group code', cors);

    const text = await request.text();
    if (text.length > MAX_SYNC_BODY_BYTES) return errorJson(413, 'Too much at once', cors);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return errorJson(400, 'Invalid JSON', cors);
    }
    const parsed = parseSyncRequest(body);
    if (typeof parsed === 'string') return errorJson(400, parsed, cors);

    const backend: SyncBackend = env.LISTS.get(env.LISTS.idFromName(GROUP_OBJECT));
    try {
      return json(200, await backend.sync(parsed), { ...cors, 'Cache-Control': 'no-store' });
    } catch (err) {
      if (err instanceof TooManyRecordsError || String(err).includes('TooManyRecords')) {
        return errorJson(413, 'Lists are full', cors);
      }
      throw err;
    }
  },
};
