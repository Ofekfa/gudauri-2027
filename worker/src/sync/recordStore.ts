/**
 * Record storage for shared lists, behind a small interface so the merge
 * rules are tested in memory and run on Durable Object SQLite in production.
 * Rule: the change that reaches the server last wins, per record; a null
 * value is kept as a tombstone so deletions reach every phone.
 */
import {
  MAX_RECORDS_PER_DOC,
  type ServerRecord,
  type SyncRequest,
  type SyncResponse,
} from '../../../src/lib/sync/protocol';

export interface RecordStore {
  /** Current revision for the whole group (all docs share one counter). */
  revision(): number;
  count(doc: string): number;
  get(doc: string, key: string): ServerRecord | null;
  put(doc: string, record: ServerRecord): void;
  changedSince(doc: string, since: number): ServerRecord[];
  setRevision(rev: number): void;
}

export class TooManyRecordsError extends Error {
  constructor() {
    // The message survives the Durable Object RPC boundary (instanceof doesn't).
    super('TooManyRecords');
  }
}

/** Applies a request's changes and returns everything the phone hasn't seen. */
export function applySync(store: RecordStore, request: SyncRequest): SyncResponse {
  const newKeys = request.changes.filter((c) => store.get(request.doc, c.key) === null).length;
  if (store.count(request.doc) + newKeys > MAX_RECORDS_PER_DOC) throw new TooManyRecordsError();
  let rev = store.revision();
  for (const change of request.changes) {
    const current = store.get(request.doc, change.key);
    // Unchanged values (e.g. a resend) don't bump the revision.
    if (current && current.value === change.value) continue;
    rev += 1;
    store.put(request.doc, { ...change, by: request.by, rev });
  }
  store.setRevision(rev);
  return { rev, changes: store.changedSince(request.doc, request.since) };
}

export function memoryRecordStore(): RecordStore {
  const docs = new Map<string, Map<string, ServerRecord>>();
  let revision = 0;
  const doc = (name: string) => docs.get(name) ?? docs.set(name, new Map()).get(name)!;
  return {
    revision: () => revision,
    count: (name) => doc(name).size,
    get: (name, key) => doc(name).get(key) ?? null,
    put: (name, record) => void doc(name).set(record.key, record),
    changedSince: (name, since) =>
      [...doc(name).values()].filter((r) => r.rev > since).sort((a, b) => a.rev - b.rev),
    setRevision: (rev) => {
      revision = rev;
    },
  };
}
