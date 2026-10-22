/**
 * Durable Object holding the group's shared lists (one instance, SQLite
 * storage). All writes go through this single object, so revisions are
 * strictly ordered and merges never race.
 */
import { DurableObject } from 'cloudflare:workers';
import type { ServerRecord, SyncRequest, SyncResponse } from '../../../src/lib/sync/protocol';
import type { Env } from '../env';
import { applySync, type RecordStore } from './recordStore';

interface Row extends Record<string, SqlStorageValue> {
  key: string;
  value: string | null;
  by: string;
  rev: number;
}

function sqlRecordStore(sql: SqlStorage): RecordStore {
  sql.exec(`CREATE TABLE IF NOT EXISTS records (
    doc TEXT NOT NULL, key TEXT NOT NULL, value TEXT, by TEXT NOT NULL, rev INTEGER NOT NULL,
    PRIMARY KEY (doc, key))`);
  sql.exec('CREATE INDEX IF NOT EXISTS records_rev ON records (doc, rev)');
  sql.exec('CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, num INTEGER NOT NULL)');
  const toRecord = (r: Row) =>
    ({ key: r.key, value: r.value, by: r.by, rev: r.rev }) as ServerRecord;
  return {
    revision: () =>
      sql.exec<{ num: number }>("SELECT num FROM meta WHERE name = 'rev'").toArray()[0]?.num ?? 0,
    count: (doc) =>
      sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM records WHERE doc = ?', doc).one().n,
    get: (doc, key) => {
      const row = sql
        .exec<Row>('SELECT key, value, by, rev FROM records WHERE doc = ? AND key = ?', doc, key)
        .toArray()[0];
      return row ? toRecord(row) : null;
    },
    put: (doc, r) => {
      sql.exec(
        'INSERT INTO records (doc, key, value, by, rev) VALUES (?, ?, ?, ?, ?) ON CONFLICT (doc, key) DO UPDATE SET value = excluded.value, by = excluded.by, rev = excluded.rev',
        doc,
        r.key,
        r.value,
        r.by,
        r.rev,
      );
    },
    changedSince: (doc, since) =>
      sql
        .exec<Row>(
          'SELECT key, value, by, rev FROM records WHERE doc = ? AND rev > ? ORDER BY rev',
          doc,
          since,
        )
        .toArray()
        .map(toRecord),
    setRevision: (rev) => {
      sql.exec(
        "INSERT INTO meta (name, num) VALUES ('rev', ?) ON CONFLICT (name) DO UPDATE SET num = excluded.num",
        rev,
      );
    },
  };
}

export class ListsStore extends DurableObject<Env> {
  private readonly store: RecordStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = sqlRecordStore(ctx.storage.sql);
  }

  /** Called over RPC by the /sync route after it has authenticated and validated the request. */
  sync(request: SyncRequest): SyncResponse {
    return this.ctx.storage.transactionSync(() => applySync(this.store, request));
  }
}
