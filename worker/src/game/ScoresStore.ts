/**
 * Durable Object for the shared ski-game scores (SQLite). One instance
 * ("scores") serves the group; it handles one request at a time and each
 * submission runs in a transaction, so simultaneous runs are never lost.
 */
import { DurableObject } from 'cloudflare:workers';
import type { TravelerId } from '../../../src/data/trip';
import type { ScoreEntry, ScoreSubmission, ScoreTable } from '../../../src/game/scores';
import type { Env } from '../env';
import {
  listScores,
  submitScore,
  type ScoreListing,
  type ScoresDb,
  type StaleEpoch,
  type StoredRun,
  type SubmitResult,
} from './logic';

interface RunRow extends Record<string, SqlStorageValue> {
  run_id: string;
  character: string;
  score: number;
  achieved_at: string;
  played_by: string | null;
  duration_ms: number | null;
  was_best: number;
}

const toEntry = (r: RunRow): ScoreEntry => ({
  score: r.score,
  achievedAt: r.achieved_at,
  runId: r.run_id,
  ...(r.played_by ? { playedBy: r.played_by as TravelerId } : {}),
});

// Same order as compareEntries: score, then earlier, then runId.
const ORDER = 'ORDER BY score DESC, achieved_at ASC, run_id ASC';

function sqlScoresDb(sql: SqlStorage): ScoresDb {
  sql.exec(`CREATE TABLE IF NOT EXISTS runs (run_id TEXT PRIMARY KEY, character TEXT NOT NULL,
    score INTEGER NOT NULL, achieved_at TEXT NOT NULL, played_by TEXT, duration_ms INTEGER,
    was_best INTEGER NOT NULL)`);
  sql.exec('CREATE INDEX IF NOT EXISTS runs_by_character ON runs (character, score DESC)');
  sql.exec('CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, num INTEGER NOT NULL)');
  const toRun = (r: RunRow): StoredRun => ({
    ...toEntry(r),
    character: r.character as TravelerId,
    ...(r.duration_ms !== null ? { durationMs: r.duration_ms } : {}),
    wasBest: r.was_best === 1,
  });
  return {
    counts: () => {
      const counts: Partial<Record<TravelerId, number>> = {};
      for (const r of sql
        .exec<{ character: string; n: number }>(
          'SELECT character, COUNT(*) AS n FROM runs GROUP BY character',
        )
        .toArray())
        counts[r.character as TravelerId] = r.n;
      return counts;
    },
    allRuns: () => sql.exec<RunRow>(`SELECT * FROM runs ${ORDER}`).toArray().map(toRun),
    deleteAllRuns: () => void sql.exec('DELETE FROM runs'),
    epoch: () =>
      sql.exec<{ num: number }>("SELECT num FROM meta WHERE name = 'epoch'").toArray()[0]?.num ??
      null,
    setEpoch: (epoch) =>
      void sql.exec(
        "INSERT INTO meta (name, num) VALUES ('epoch', ?) ON CONFLICT (name) DO UPDATE SET num = excluded.num",
        epoch,
      ),
    getRun: (id) => {
      const r = sql.exec<RunRow>('SELECT * FROM runs WHERE run_id = ?', id).toArray()[0];
      return r ? toRun(r) : null;
    },
    insertRun: (run: StoredRun) => {
      sql.exec(
        `INSERT INTO runs (run_id, character, score, achieved_at, played_by, duration_ms, was_best)
         VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (run_id) DO NOTHING`,
        run.runId,
        run.character,
        run.score,
        run.achievedAt,
        run.playedBy ?? null,
        run.durationMs ?? null,
        run.wasBest ? 1 : 0,
      );
    },
    top: (character, limit) =>
      sql
        .exec<RunRow>(`SELECT * FROM runs WHERE character = ? ${ORDER} LIMIT ?`, character, limit)
        .toArray()
        .map(toEntry),
    topAll: (limit) => {
      const table: ScoreTable = {};
      const rows = sql
        .exec<RunRow>(
          `SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY character ${ORDER}) AS n FROM runs)
           WHERE n <= ? ${ORDER}`,
          limit,
        )
        .toArray();
      for (const r of rows) (table[r.character as TravelerId] ??= []).push(toEntry(r));
      return table;
    },
  };
}

export class ScoresStore extends DurableObject<Env> {
  private dbCache: ScoresDb | null = null;
  private get db() {
    return (this.dbCache ??= sqlScoresDb(this.ctx.storage.sql));
  }

  /** `epoch` is the configured SCORE_EPOCH; a higher one than stored resets (see applyEpoch). */
  list(limit: number, epoch: number): ScoreListing {
    return this.ctx.storage.transactionSync(() => listScores(this.db, epoch, limit));
  }
  submit(
    submission: ScoreSubmission,
    playedBy: TravelerId,
    epoch: number,
  ): SubmitResult | StaleEpoch {
    return this.ctx.storage.transactionSync(() =>
      submitScore(this.db, submission, playedBy, epoch),
    );
  }
}
