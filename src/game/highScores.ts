import type { TravelerId } from '../data/trip';
import type { KeyValueStore } from '../lib/storage/safeStorage';
import { HIGH_SCORES_PER_CHARACTER } from './constants';

export interface HighScore {
  score: number;
  /** Epoch ms. */
  at: number;
}

export type HighScoreTable = Partial<Record<TravelerId, HighScore[]>>;

const KEY = 'game:highScores';

/** Inserts a score, keeping the top N (highest first, earlier wins ties). Returns its rank or -1. */
export function insertHighScore(
  list: readonly HighScore[],
  entry: HighScore,
  limit = HIGH_SCORES_PER_CHARACTER,
): { list: HighScore[]; rank: number } {
  if (entry.score <= 0) return { list: [...list], rank: -1 };
  const next = [...list, entry].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, limit);
  return { list: next, rank: next.indexOf(entry) };
}

export function loadHighScores(store: KeyValueStore): HighScoreTable {
  try {
    const parsed: unknown = JSON.parse(store.get(KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    const table: HighScoreTable = {};
    for (const [id, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue;
      table[id as TravelerId] = list
        .filter((s): s is HighScore => Number.isFinite(s?.score) && Number.isFinite(s?.at))
        .slice(0, HIGH_SCORES_PER_CHARACTER);
    }
    return table;
  } catch {
    return {};
  }
}

export function saveHighScores(store: KeyValueStore, table: HighScoreTable): void {
  store.set(KEY, JSON.stringify(table));
}
