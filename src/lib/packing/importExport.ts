import type { TravelerId } from '../../data/trip';
import {
  CATEGORIES,
  MAX_ITEMS_PER_LIST,
  normalizeName,
  OWNERSHIPS,
  STATE_VERSION,
  createEmptyState,
  type PackingItem,
  type PackingState,
} from './model';

export const EXPORT_APP_ID = 'gudauri-2027/packing';

export interface ExportFile {
  app: typeof EXPORT_APP_ID;
  exportedAt: string;
  data: PackingState;
}

export function serializeExport(state: PackingState, now: Date): string {
  const file: ExportFile = { app: EXPORT_APP_ID, exportedAt: now.toISOString(), data: state };
  return JSON.stringify(file, null, 2);
}

export type ParseResult = { ok: true; state: PackingState } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function parseItem(raw: unknown): PackingItem | null {
  if (!isRecord(raw)) return null;
  const { id, name, category, ownership, packed, createdAt } = raw;
  if (typeof id !== 'string' || !id || typeof name !== 'string') return null;
  const cleanName = normalizeName(name);
  if (!cleanName) return null;
  if (!CATEGORIES.includes(category as PackingItem['category'])) return null;
  if (!OWNERSHIPS.includes(ownership as PackingItem['ownership'])) return null;
  return {
    id,
    name: cleanName,
    category: category as PackingItem['category'],
    ownership: ownership as PackingItem['ownership'],
    packed: packed === true,
    createdAt: typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : 0,
  };
}

/**
 * Validates untrusted state (an imported file or stored data). Unknown travelers
 * are dropped, invalid items are skipped, and missing travelers get empty lists.
 */
export function validateState(raw: unknown, travelers: readonly TravelerId[]): ParseResult {
  if (!isRecord(raw) || raw.version !== STATE_VERSION || !isRecord(raw.lists)) {
    return {
      ok: false,
      error: 'This file isn’t a Gudauri 2027 packing list (or is from a newer version).',
    };
  }
  const state = createEmptyState(travelers);
  const decided = isRecord(raw.templateDecided) ? raw.templateDecided : {};
  for (const traveler of travelers) {
    const items = raw.lists[traveler];
    if (Array.isArray(items)) {
      const seen = new Set<string>();
      state.lists[traveler] = items
        .map(parseItem)
        .filter((i): i is PackingItem => i !== null && !seen.has(i.id) && Boolean(seen.add(i.id)))
        .slice(0, MAX_ITEMS_PER_LIST);
    }
    state.templateDecided[traveler] =
      decided[traveler] === true || state.lists[traveler].length > 0;
  }
  return { ok: true, state };
}

export function parseImport(text: string, travelers: readonly TravelerId[]): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' };
  }
  if (!isRecord(json) || json.app !== EXPORT_APP_ID) {
    return { ok: false, error: 'This file wasn’t exported from the Gudauri 2027 packing list.' };
  }
  return validateState(json.data, travelers);
}
