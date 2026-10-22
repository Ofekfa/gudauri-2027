/**
 * The /sync wire format, shared by the site and the Worker. Lists are stored
 * as records: one per list item (or per small flag), keyed like
 * "item/<listId>/<itemId>". A null value is a deletion (tombstone).
 */
import { trip, type TravelerId } from '../../data/trip';

export const SYNC_DOCS = ['packing', 'todo'] as const;
export type SyncDoc = (typeof SYNC_DOCS)[number];

export const MAX_KEY_LENGTH = 120;
export const MAX_VALUE_LENGTH = 2_000;
export const MAX_CHANGES_PER_REQUEST = 600;
export const MAX_RECORDS_PER_DOC = 3_000;
export const MAX_SYNC_BODY_BYTES = 600_000;
const KEY_PATTERN = /^[a-z]+\/[a-z0-9-]+\/[A-Za-z0-9_-]+$/;
const TRAVELER_IDS = trip.travelers.map((t) => t.id);

export interface RecordChange {
  key: string;
  /** JSON text of the record, or null to delete it. */
  value: string | null;
}

export interface SyncRequest {
  doc: SyncDoc;
  /** The last revision this phone has seen (0 = never synced). */
  since: number;
  /** Whose phone this is, shown as "changed by". */
  by: TravelerId;
  changes: RecordChange[];
}

export interface ServerRecord extends RecordChange {
  by: TravelerId;
  rev: number;
}

export interface SyncResponse {
  rev: number;
  /** Every record changed after `since`, including this request's own. */
  changes: ServerRecord[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isTraveler = (v: unknown): v is TravelerId => TRAVELER_IDS.includes(v as TravelerId);
const isRev = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

function validChange(raw: unknown): RecordChange | null {
  if (!isRecord(raw) || typeof raw.key !== 'string') return null;
  if (raw.key.length > MAX_KEY_LENGTH || !KEY_PATTERN.test(raw.key)) return null;
  if (raw.value === null) return { key: raw.key, value: null };
  if (typeof raw.value !== 'string' || raw.value.length > MAX_VALUE_LENGTH) return null;
  try {
    JSON.parse(raw.value);
  } catch {
    return null;
  }
  return { key: raw.key, value: raw.value };
}

/** Validates a request body; returns an error message instead of throwing. */
export function parseSyncRequest(raw: unknown): SyncRequest | string {
  if (!isRecord(raw)) return 'Expected an object';
  if (!SYNC_DOCS.includes(raw.doc as SyncDoc)) return 'Unknown doc';
  if (!isRev(raw.since)) return 'Bad since';
  if (!isTraveler(raw.by)) return 'Bad by';
  if (!Array.isArray(raw.changes) || raw.changes.length > MAX_CHANGES_PER_REQUEST)
    return 'Bad changes';
  const changes: RecordChange[] = [];
  for (const c of raw.changes) {
    const change = validChange(c);
    if (!change) return 'Bad change';
    changes.push(change);
  }
  return { doc: raw.doc as SyncDoc, since: raw.since, by: raw.by, changes };
}

/** Validates the Worker's response on the phone (the server's data is still checked by the adapters). */
export function parseSyncResponse(raw: unknown): SyncResponse {
  if (!isRecord(raw) || !isRev(raw.rev) || !Array.isArray(raw.changes))
    throw new Error('Bad sync response');
  const changes: ServerRecord[] = [];
  for (const c of raw.changes) {
    const change = validChange(c);
    if (!change || !isRecord(c) || !isTraveler(c.by) || !isRev(c.rev)) continue;
    changes.push({ ...change, by: c.by, rev: c.rev });
  }
  return { rev: raw.rev, changes };
}
