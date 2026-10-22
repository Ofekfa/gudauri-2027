/**
 * Lists as flat records (key → JSON text) so phones can exchange just what
 * changed. Values are canonical JSON (sorted keys) so equal items always
 * produce equal text and never look like changes.
 */
import type { RecordChange } from './protocol';

export type Records = Map<string, string>;

/** Keys allowed in a record id segment (UUIDs and our own ids). */
export const SYNCABLE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** What changed from `base` to `current`: new or edited records, and deletions as null. */
export function diffRecords(base: Records, current: Records): RecordChange[] {
  const changes: RecordChange[] = [];
  for (const [key, value] of current) if (base.get(key) !== value) changes.push({ key, value });
  for (const key of base.keys()) if (!current.has(key)) changes.push({ key, value: null });
  return changes;
}

export function applyChanges(records: Records, changes: readonly RecordChange[]): Records {
  const next = new Map(records);
  for (const { key, value } of changes) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

export const recordsFromObject = (o: Record<string, string>): Records => new Map(Object.entries(o));
export const recordsToObject = (r: Records): Record<string, string> => Object.fromEntries(r);
