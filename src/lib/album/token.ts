/**
 * The album token on this phone. Joining reuses the group code stored for
 * shared lists (src/lib/sync/settings.ts); the token is fetched when first
 * needed and renewed quietly while still valid.
 */
import type { TravelerId } from '../../data/trip';
import { appStore, type KeyValueStore } from '../storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';
import { isJoined, syncSettings } from '../sync/settings';
import { WORKER_URL } from '../worker/config';

const VERSION = 1;
/** Renew when less than this is left. */
const RENEW_BEFORE_MS = 14 * 86_400_000;
const REQUEST_TIMEOUT_MS = 15_000;

interface StoredToken {
  version: typeof VERSION;
  token: string | null;
  expiresAt: number;
  who: TravelerId | null;
}

const spec: VersionedSpec<StoredToken> = {
  key: 'album:token',
  version: VERSION,
  validate: (raw) => {
    const r = raw as Partial<StoredToken> | null;
    if (!r || typeof r.expiresAt !== 'number') return null;
    return {
      version: VERSION,
      token: typeof r.token === 'string' ? r.token : null,
      expiresAt: r.expiresAt,
      who: r.who ?? null,
    };
  },
  empty: () => ({ version: VERSION, token: null, expiresAt: 0, who: null }),
};

export type TokenResult =
  { token: string } | { error: 'not-joined' | 'wrong-code' | 'not-set-up' | 'offline' };

export function clearAlbumToken(store: KeyValueStore = appStore) {
  saveVersioned(store, spec, spec.empty());
}

/** A valid token for changing the album, asking the Worker only when needed. */
export async function getAlbumToken(
  now = Date.now(),
  {
    store = appStore,
    url = WORKER_URL,
    fetchImpl = fetch,
  }: { store?: KeyValueStore; url?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<TokenResult> {
  const settings = syncSettings.get();
  if (!isJoined(settings) || !url) return { error: 'not-joined' };
  const saved = loadVersioned(store, spec).value;
  const valid = saved.token && saved.expiresAt > now && saved.who === settings.me;
  if (valid && saved.expiresAt - now > RENEW_BEFORE_MS) return { token: saved.token! };

  let res: Response;
  try {
    res = await fetchImpl(`${url}/album/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(valid ? { Authorization: `Bearer ${saved.token}` } : {}),
      },
      body: JSON.stringify({ code: settings.code, who: settings.me }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Offline: an older but still valid token is fine for now.
    return valid ? { token: saved.token! } : { error: 'offline' };
  }
  if (res.status === 401) {
    clearAlbumToken(store);
    return { error: 'wrong-code' };
  }
  if (res.status === 501) return { error: 'not-set-up' };
  if (!res.ok) return valid ? { token: saved.token! } : { error: 'offline' };
  const body = (await res.json().catch(() => ({}))) as { token?: unknown; expiresAt?: unknown };
  if (typeof body.token !== 'string' || typeof body.expiresAt !== 'string')
    return { error: 'offline' };
  saveVersioned(store, spec, {
    version: VERSION,
    token: body.token,
    expiresAt: Date.parse(body.expiresAt),
    who: settings.me,
  });
  return { token: body.token };
}
