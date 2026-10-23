/**
 * Shared high-score rules over a tiny storage interface: memory in tests,
 * Durable Object SQLite in production. Every run is kept (idempotent by
 * runId); a character's top five is a query.
 */
import type { TravelerId } from '../../../src/data/trip';
import { HIGH_SCORES_PER_CHARACTER } from '../../../src/game/constants';
import {
  compareEntries,
  type ScoreEntry,
  type ScoreSubmission,
  type ScoreTable,
} from '../../../src/game/scores';

export interface StoredRun extends ScoreEntry {
  character: TravelerId;
  durationMs?: number;
  /** Whether it was the character's new shared best when it arrived. */
  wasBest: boolean;
}

export interface ScoresDb {
  getRun(runId: string): StoredRun | null;
  insertRun(run: StoredRun): void;
  top(character: TravelerId, limit: number): ScoreEntry[];
  topAll(limit: number): ScoreTable;
}

export interface SubmitResult {
  character: TravelerId;
  top: ScoreEntry[];
  /** True if this run beat the character's shared best (also when re-sent). */
  newBest: boolean;
  created: boolean;
}

const entryOf = ({ score, achievedAt, runId, playedBy }: StoredRun): ScoreEntry => ({
  score,
  achievedAt,
  runId,
  ...(playedBy ? { playedBy } : {}),
});

export function submitScore(
  db: ScoresDb,
  submission: ScoreSubmission,
  playedBy: TravelerId,
): SubmitResult {
  const { character } = submission;
  const existing = db.getRun(submission.runId);
  if (existing) {
    return {
      character: existing.character,
      top: db.top(existing.character, HIGH_SCORES_PER_CHARACTER),
      newBest: existing.wasBest,
      created: false,
    };
  }
  const run: StoredRun = { ...submission, playedBy, wasBest: false };
  const best = db.top(character, 1)[0];
  run.wasBest = !best || compareEntries(entryOf(run), best) < 0;
  db.insertRun(run);
  return {
    character,
    top: db.top(character, HIGH_SCORES_PER_CHARACTER),
    newBest: run.wasBest,
    created: true,
  };
}

export function memoryScoresDb(): ScoresDb {
  const runs = new Map<string, StoredRun>();
  const top = (character: TravelerId, limit: number) =>
    [...runs.values()]
      .filter((r) => r.character === character)
      .map(entryOf)
      .sort(compareEntries)
      .slice(0, limit);
  return {
    getRun: (id) => runs.get(id) ?? null,
    insertRun: (run) => void runs.set(run.runId, run),
    top,
    topAll: (limit) => {
      const table: ScoreTable = {};
      for (const character of new Set([...runs.values()].map((r) => r.character)))
        table[character] = top(character, limit);
      return table;
    },
  };
}
