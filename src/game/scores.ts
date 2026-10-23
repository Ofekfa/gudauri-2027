/**
 * Shared high scores: the entry format, merging, and the server-side
 * plausibility check. Shared by the site and the Worker; depends only on the
 * game constants, so the bound always follows the real tuning.
 */
import { trip, type TravelerId } from '../data/trip';
import { HIGH_SCORES_PER_CHARACTER, METERS_PER_PX, SCORE, SPAWN, SPEED } from './constants';

export interface ScoreEntry {
  score: number;
  /** ISO 8601. */
  achievedAt: string;
  /** Unique per run (a UUID, or "legacy-…" for scores from before syncing). */
  runId: string;
  /** Whose phone it was played on, when that phone has joined the group. */
  playedBy?: TravelerId;
}

export type ScoreTable = Partial<Record<TravelerId, ScoreEntry[]>>;

export const RUN_ID = /^[A-Za-z0-9-]{8,64}$/;
export const MIN_DURATION_MS = 1_000;
export const MAX_DURATION_MS = 3 * 3_600_000;
/** Rows already on screen when a run starts (any phone or monitor height). */
const SCREEN_ALLOWANCE_PX = 4_000;
/** Headroom on top of the theoretical maximum. */
const PLAUSIBILITY_SLACK = 1.1;
/** Client clocks may run a little ahead. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const MS_PER_S = 1_000;

const TRAVELERS: readonly TravelerId[] = trip.travelers.map((t) => t.id);
export const isTraveler = (v: unknown): v is TravelerId => TRAVELERS.includes(v as TravelerId);

/** Highest first; ties go to whoever got there first. */
export function compareEntries(a: ScoreEntry, b: ScoreEntry): number {
  return (
    b.score - a.score ||
    (a.achievedAt < b.achievedAt ? -1 : a.achievedAt > b.achievedAt ? 1 : 0) ||
    (a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0)
  );
}

/** One list of the best runs from several, without duplicates (same runId). */
export function mergeTop(...lists: readonly (readonly ScoreEntry[] | undefined)[]): ScoreEntry[] {
  const byRun = new Map<string, ScoreEntry>();
  for (const entry of lists.flatMap((l) => l ?? [])) {
    const known = byRun.get(entry.runId);
    // The same run seen twice: keep the copy that knows who played it.
    if (!known || (!known.playedBy && entry.playedBy)) byRun.set(entry.runId, entry);
  }
  return [...byRun.values()].sort(compareEntries).slice(0, HIGH_SCORES_PER_CHARACTER);
}

export function mergeTables(a: ScoreTable, b: ScoreTable): ScoreTable {
  const table: ScoreTable = {};
  for (const id of TRAVELERS) {
    const merged = mergeTop(a[id], b[id]);
    if (merged.length) table[id] = merged;
  }
  return table;
}

export const bestOf = (table: ScoreTable, id: TravelerId): number => table[id]?.[0]?.score ?? 0;

/** The furthest anyone can ski in `seconds` (full speed ramp, never crashing). */
export function maxDistancePx(seconds: number): number {
  const rampSeconds = (SPEED.max - SPEED.start) / SPEED.rampPerSecond;
  const ramp = Math.min(seconds, rampSeconds);
  const ramped = SPEED.start * ramp + (SPEED.rampPerSecond * ramp * ramp) / 2;
  return ramped + SPEED.max * Math.max(0, seconds - rampSeconds);
}

/**
 * An upper bound on a run's score: every metre at top speed, plus the best
 * collectible in every slot of every row that could have scrolled past.
 */
export function maxPlausibleScore(seconds: number): number {
  const distancePx = maxDistancePx(seconds);
  const meters = distancePx * METERS_PER_PX * SCORE.perMeter;
  const rows =
    (distancePx + SCREEN_ALLOWANCE_PX) / (SPAWN.rowGapMin * (1 - SPAWN.rowGapJitter)) + 1;
  const bonus = rows * SPAWN.maxItemsPerRowEnd * Math.max(SCORE.khachapuri, SCORE.snowflake);
  return Math.ceil((meters + bonus) * PLAUSIBILITY_SLACK);
}

export interface ScoreSubmission {
  character: TravelerId;
  score: number;
  runId: string;
  achievedAt: string;
  /** Play time (pauses excluded). Absent for scores from before syncing. */
  durationMs?: number;
}

export type ParsedSubmission =
  { ok: true; value: ScoreSubmission } | { ok: false; status: 400 | 422; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates POST /game/scores (shape → 400, impossible score → 422). */
export function parseScoreSubmission(raw: unknown, nowMs: number): ParsedSubmission {
  const bad = (error: string) => ({ ok: false as const, status: 400 as const, error });
  if (!isRecord(raw)) return bad('Invalid request');
  const { character, score, runId, durationMs, achievedAt } = raw;
  if (!isTraveler(character)) return bad('Unknown skier');
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) return bad('Bad run id');
  if (!Number.isSafeInteger(score) || (score as number) < 1) return bad('Bad score');
  if (
    durationMs !== undefined &&
    (!Number.isSafeInteger(durationMs) ||
      (durationMs as number) < MIN_DURATION_MS ||
      (durationMs as number) > MAX_DURATION_MS)
  )
    return bad('Bad duration');
  let at = nowMs;
  if (achievedAt !== undefined) {
    const parsed = typeof achievedAt === 'string' ? Date.parse(achievedAt) : NaN;
    if (Number.isNaN(parsed) || parsed > nowMs + MAX_CLOCK_SKEW_MS) return bad('Bad time');
    at = parsed;
  }
  const seconds = ((durationMs as number | undefined) ?? MAX_DURATION_MS) / MS_PER_S;
  if ((score as number) > maxPlausibleScore(seconds))
    return { ok: false, status: 422, error: 'That score isn’t possible in that time' };
  return {
    ok: true,
    value: {
      character,
      score: score as number,
      runId,
      achievedAt: new Date(at).toISOString(),
      ...(durationMs !== undefined ? { durationMs: durationMs as number } : {}),
    },
  };
}

/** Validates GET /game/scores on the phone; bad entries are dropped. */
export function parseScoreTable(raw: unknown): ScoreTable {
  if (!isRecord(raw) || !isRecord(raw.scores)) throw new Error('Bad scores');
  const table: ScoreTable = {};
  for (const [id, list] of Object.entries(raw.scores)) {
    if (!isTraveler(id) || !Array.isArray(list)) continue;
    const entries = list.filter(
      (e): e is ScoreEntry =>
        isRecord(e) &&
        Number.isSafeInteger(e.score) &&
        typeof e.runId === 'string' &&
        RUN_ID.test(e.runId) &&
        typeof e.achievedAt === 'string' &&
        !Number.isNaN(Date.parse(e.achievedAt)) &&
        (e.playedBy === undefined || isTraveler(e.playedBy)),
    );
    table[id] = mergeTop(entries);
  }
  return table;
}
