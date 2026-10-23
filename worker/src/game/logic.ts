/**
 * Shared high-score rules over a tiny storage interface: memory in tests,
 * Durable Object SQLite in production. Every run is kept (idempotent by
 * runId); a character's top five is a query.
 */
import type { TravelerId } from '../../../src/data/trip';
import { HIGH_SCORES_PER_CHARACTER } from '../../../src/game/constants';
import {
  compareEntries,
  FIRST_EPOCH,
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
  /** Every run stored, per character. */
  counts(): Partial<Record<TravelerId, number>>;
  allRuns(): StoredRun[];
  deleteAllRuns(): void;
  /** The epoch last applied (null before the first one). */
  epoch(): number | null;
  setEpoch(epoch: number): void;
}

export interface ScoreListing {
  scores: ScoreTable;
  epoch: number;
  /** How many runs each character has stored (the top five is a subset). */
  runs: Partial<Record<TravelerId, number>>;
}

export interface StaleEpoch {
  stale: true;
  epoch: number;
}

/**
 * Brings the store to the configured epoch (`SCORE_EPOCH`). A higher one is a
 * reset: every run is logged (so `wrangler tail` keeps a full copy) and then
 * deleted. A lower one never undoes a reset. Returns the epoch in force.
 */
export function applyEpoch(
  db: ScoresDb,
  configured: number,
  log: (line: string) => void = console.log,
): number {
  const current = db.epoch();
  if (current === null) {
    db.setEpoch(configured);
    return configured;
  }
  if (configured <= current) return current;
  log(JSON.stringify({ event: 'scores-reset', from: current, to: configured, runs: db.allRuns() }));
  db.deleteAllRuns();
  db.setEpoch(configured);
  return configured;
}

export function listScores(db: ScoresDb, configured: number, limit: number): ScoreListing {
  const epoch = applyEpoch(db, configured);
  return { scores: db.topAll(limit), epoch, runs: db.counts() };
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
  configured: number = FIRST_EPOCH,
): SubmitResult | StaleEpoch {
  const epoch = applyEpoch(db, configured);
  // A run from before a reset (queued on a phone that hadn't heard yet) is dropped.
  if ((submission.epoch ?? FIRST_EPOCH) < epoch) return { stale: true, epoch };
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
  const { score, runId, achievedAt, durationMs } = submission;
  const run: StoredRun = {
    character,
    score,
    runId,
    achievedAt,
    ...(durationMs !== undefined ? { durationMs } : {}),
    playedBy,
    wasBest: false,
  };
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
  let epoch: number | null = null;
  const top = (character: TravelerId, limit: number) =>
    [...runs.values()]
      .filter((r) => r.character === character)
      .map(entryOf)
      .sort(compareEntries)
      .slice(0, limit);
  return {
    getRun: (id) => runs.get(id) ?? null,
    counts: () => {
      const counts: Partial<Record<TravelerId, number>> = {};
      for (const r of runs.values()) counts[r.character] = (counts[r.character] ?? 0) + 1;
      return counts;
    },
    allRuns: () => [...runs.values()],
    deleteAllRuns: () => runs.clear(),
    epoch: () => epoch,
    setEpoch: (next) => void (epoch = next),
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
