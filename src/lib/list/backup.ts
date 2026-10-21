/** Result of parsing an untrusted import file. */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_IMPORT_BYTES = 1_000_000;

/** "gudauri-packing-2027-01-31.json" */
export function backupFileName(stem: string, now: Date): string {
  return `${stem}-${now.toISOString().slice(0, 10)}.json`;
}
