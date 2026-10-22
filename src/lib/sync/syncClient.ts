/**
 * One sync round for a doc: send what changed since the last sync, then
 * merge everything others changed, without losing edits made while the
 * request was in flight (those are sent next round).
 */
import type { TravelerId } from '../../data/trip';
import { appStore, type KeyValueStore } from '../storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';
import type { SyncAdapter } from './adapters';
import { parseSyncResponse, type SyncDoc } from './protocol';
import { applyChanges, diffRecords, recordsFromObject, recordsToObject } from './records';

const REQUEST_TIMEOUT_MS = 15_000;
const VERSION = 1;

/** What this phone last agreed with the server. */
interface DocSyncState {
  version: typeof VERSION;
  rev: number;
  base: Record<string, string>;
  /** Who last changed each record (for "changed by"). */
  by: Record<string, TravelerId>;
}

const docSpec = (doc: SyncDoc): VersionedSpec<DocSyncState> => ({
  key: `sync:${doc}`,
  version: VERSION,
  validate: (raw) => {
    const r = raw as Partial<DocSyncState> | null;
    if (!r || typeof r.rev !== 'number' || typeof r.base !== 'object' || r.base === null)
      return null;
    return {
      version: VERSION,
      rev: r.rev,
      base: r.base,
      by: typeof r.by === 'object' && r.by ? r.by : {},
    };
  },
  empty: () => ({ version: VERSION, rev: 0, base: {}, by: {} }),
});

export type SyncOutcome<S> =
  | { status: 'synced'; state: S | null; by: Record<string, TravelerId> }
  | { status: 'not-set-up' | 'wrong-code' | 'offline' | 'error' };

export const loadChangedBy = (doc: SyncDoc, store: KeyValueStore = appStore) =>
  loadVersioned(store, docSpec(doc)).value.by;

/** Forget what was synced (e.g. after leaving the group). */
export const resetDocSync = (doc: SyncDoc, store: KeyValueStore = appStore) =>
  saveVersioned(store, docSpec(doc), docSpec(doc).empty());

export async function syncDoc<S>(options: {
  adapter: SyncAdapter<S>;
  getState: () => S;
  url: string;
  code: string;
  me: TravelerId;
  store?: KeyValueStore;
  fetchImpl?: typeof fetch;
}): Promise<SyncOutcome<S>> {
  const { adapter, getState, url, code, me, store = appStore, fetchImpl = fetch } = options;
  const spec = docSpec(adapter.doc);
  const saved = loadVersioned(store, spec).value;
  const sent = adapter.toRecords(getState());
  const changes = diffRecords(recordsFromObject(saved.base), sent);

  let res: Response;
  try {
    res = await fetchImpl(`${url}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${code}` },
      body: JSON.stringify({ doc: adapter.doc, since: saved.rev, by: me, changes }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { status: 'offline' };
  }
  if (res.status === 501) return { status: 'not-set-up' };
  if (res.status === 401) return { status: 'wrong-code' };
  if (!res.ok) return { status: 'error' };
  let response;
  try {
    response = parseSyncResponse(await res.json());
  } catch {
    return { status: 'error' };
  }

  // Apply the server's view, except where the user edited locally during the request.
  const latest = adapter.toRecords(getState());
  const merged = new Map(latest);
  for (const change of response.changes) {
    if (latest.get(change.key) !== sent.get(change.key)) continue;
    if (change.value === null) merged.delete(change.key);
    else merged.set(change.key, change.value);
  }
  const by = { ...saved.by };
  for (const change of response.changes) by[change.key] = change.by;
  saveVersioned(store, spec, {
    version: VERSION,
    rev: response.rev,
    base: recordsToObject(applyChanges(sent, response.changes)),
    by,
  });

  const unchanged =
    merged.size === latest.size && [...merged].every(([k, v]) => latest.get(k) === v);
  return {
    status: 'synced',
    state: unchanged ? null : adapter.fromRecords(merged, getState()),
    by,
  };
}
