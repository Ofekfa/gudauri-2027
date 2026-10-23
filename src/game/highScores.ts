/**
 * High scores per character, top five each. Two repositories share one
 * interface: local only (this device), and synced (local cache + a pending
 * queue of runs to send + the shared scores on the Worker).
 *
 * The local copy always answers instantly; syncing only happens when the
 * page asks (page load, game over, back online, after joining), never mid-run.
 */
import type { TravelerId } from '../data/trip';
import type { TokenResult } from '../lib/album/token';
import { backoffMs } from '../lib/net/backoff';
import type { KeyValueStore } from '../lib/storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../lib/storage/versioned';
import {
  epochOf,
  FIRST_EPOCH,
  isTraveler,
  mergeTables,
  mergeTop,
  parseScoreTable,
  RUN_ID,
  type ScoreEntry,
  type ScoreTable,
} from './scores';

export type { ScoreEntry, ScoreTable } from './scores';

const TABLE_KEY = 'game:highScores';
const PENDING_KEY = 'game:pendingScores';
/** The score epoch this device last saw (see FIRST_EPOCH in scores.ts). */
const EPOCH_KEY = 'game:scoreEpoch';
const HTTP_CONFLICT = 409;
const TABLE_VERSION = 2;
const PENDING_VERSION = 1;
const REQUEST_TIMEOUT_MS = 15_000;

/** Inserts a run, keeping the top five. Returns its rank, or -1 if it didn't make it. */
export function insertHighScore(
  list: readonly ScoreEntry[],
  entry: ScoreEntry,
): { list: ScoreEntry[]; rank: number } {
  if (entry.score <= 0) return { list: [...list], rank: -1 };
  const next = mergeTop(list, [entry]);
  return { list: next, rank: next.findIndex((e) => e.runId === entry.runId) };
}

// Local table -------------------------------------------------------------

interface StoredTable {
  version: typeof TABLE_VERSION;
  table: ScoreTable;
}

const isEntry = (e: unknown): e is ScoreEntry => {
  const r = e as Partial<ScoreEntry> | null;
  return (
    !!r &&
    Number.isFinite(r.score) &&
    typeof r.achievedAt === 'string' &&
    typeof r.runId === 'string' &&
    RUN_ID.test(r.runId) &&
    (r.playedBy === undefined || isTraveler(r.playedBy))
  );
};

/** Scores from before syncing: `{score, at}` get a stable id, so re-sending never duplicates. */
function fromLegacy(id: string, raw: unknown): ScoreEntry | null {
  const r = raw as { score?: unknown; at?: unknown } | null;
  if (!Number.isFinite(r?.score) || !Number.isFinite(r?.at)) return null;
  const score = r!.score as number;
  const at = r!.at as number;
  return { score, achievedAt: new Date(at).toISOString(), runId: `legacy-${id}-${at}-${score}` };
}

const tableSpec: VersionedSpec<StoredTable> = {
  key: TABLE_KEY,
  version: TABLE_VERSION,
  migrations: {
    1: (raw) => {
      const legacy = (raw.table ?? {}) as Record<string, unknown>;
      const table: ScoreTable = {};
      for (const [id, list] of Object.entries(legacy)) {
        if (!isTraveler(id) || !Array.isArray(list)) continue;
        table[id] = mergeTop(
          list.map((s) => fromLegacy(id, s)).filter((s): s is ScoreEntry => s !== null),
        );
      }
      return { table };
    },
  },
  validate: (raw) => {
    const t = (raw as { table?: unknown }).table;
    if (typeof t !== 'object' || t === null) return null;
    const table: ScoreTable = {};
    for (const [id, list] of Object.entries(t)) {
      if (isTraveler(id) && Array.isArray(list)) table[id] = mergeTop(list.filter(isEntry));
    }
    return { version: TABLE_VERSION, table };
  },
  empty: () => ({ version: TABLE_VERSION, table: {} }),
};

export function loadHighScores(store: KeyValueStore): ScoreTable {
  // The first format had no version: wrap it so the migration can run.
  try {
    const raw: unknown = JSON.parse(store.get(TABLE_KEY) ?? 'null');
    if (raw && typeof raw === 'object' && !('version' in raw))
      store.set(TABLE_KEY, JSON.stringify({ version: 1, table: raw }));
  } catch {
    // Corrupt: loadVersioned starts empty.
  }
  return loadVersioned(store, tableSpec).value.table;
}

export function saveHighScores(store: KeyValueStore, table: ScoreTable): void {
  saveVersioned(store, tableSpec, { version: TABLE_VERSION, table });
}

// Repositories ------------------------------------------------------------

export interface RunRecord extends ScoreEntry {
  /** Play time, pauses excluded (for the server's plausibility check). */
  durationMs?: number;
}

export interface RecordResult {
  table: ScoreTable;
  /** Place in this device's top five (0 = best), or -1. */
  rank: number;
  beatsLocalBest: boolean;
}

/** synced: matches the server · offline: couldn't reach it · local: not joined / no sync. */
export type SyncState = 'synced' | 'syncing' | 'offline' | 'local';

export interface SyncResult {
  table: ScoreTable;
  state: SyncState;
  /** Runs the server confirmed as a character's new shared best. */
  newBest: string[];
  /** Runs still waiting to be sent. */
  pending: number;
  /** Runs the server refused (kept on this device). */
  rejected: number;
}

export interface HighScoreRepository {
  load(): ScoreTable;
  record(character: TravelerId, run: RunRecord): RecordResult;
  sync(): Promise<SyncResult>;
}

function recordLocally(store: KeyValueStore, character: TravelerId, run: RunRecord) {
  const table = loadHighScores(store);
  const previousBest = table[character]?.[0]?.score ?? 0;
  const entry: ScoreEntry = {
    score: run.score,
    achievedAt: run.achievedAt,
    runId: run.runId,
    ...(run.playedBy ? { playedBy: run.playedBy } : {}),
  };
  const { list, rank } = insertHighScore(table[character] ?? [], entry);
  const next = { ...table, [character]: list };
  if (rank >= 0) saveHighScores(store, next);
  return { table: next, rank, beatsLocalBest: rank === 0 && run.score > previousBest };
}

/** This device only (today's behaviour). */
export function createLocalHighScores(store: KeyValueStore): HighScoreRepository {
  return {
    load: () => loadHighScores(store),
    record: (character, run) => recordLocally(store, character, run),
    sync: async () => ({
      table: loadHighScores(store),
      state: 'local',
      newBest: [],
      pending: 0,
      rejected: 0,
    }),
  };
}

// Pending queue -------------------------------------------------------------

export interface PendingRun extends RunRecord {
  character: TravelerId;
  /** Why the server refused it; it stays on this device and isn't re-sent. */
  rejected?: string;
}

interface PendingState {
  version: typeof PENDING_VERSION;
  items: PendingRun[];
  attempts: number;
  nextAttemptAt: number;
  /** Existing local scores were queued once for the first upload. */
  migrated: boolean;
}

const pendingSpec: VersionedSpec<PendingState> = {
  key: PENDING_KEY,
  version: PENDING_VERSION,
  validate: (raw) => {
    const r = raw as Partial<PendingState>;
    if (!Array.isArray(r.items)) return null;
    return {
      version: PENDING_VERSION,
      items: r.items.filter((i) => isEntry(i) && isTraveler(i.character)),
      attempts: Number.isInteger(r.attempts) ? r.attempts! : 0,
      nextAttemptAt: Number.isFinite(r.nextAttemptAt) ? r.nextAttemptAt! : 0,
      migrated: r.migrated === true,
    };
  },
  empty: () => ({
    version: PENDING_VERSION,
    items: [],
    attempts: 0,
    nextAttemptAt: 0,
    migrated: false,
  }),
};

export const loadPending = (store: KeyValueStore) => loadVersioned(store, pendingSpec).value;
const savePending = (store: KeyValueStore, state: PendingState) =>
  saveVersioned(store, pendingSpec, state);

export function loadScoreEpoch(store: KeyValueStore): number {
  const n = Number(store.get(EPOCH_KEY));
  return Number.isSafeInteger(n) && n >= FIRST_EPOCH ? n : FIRST_EPOCH;
}

/**
 * The shared scores were reset: forget this device's records and unsent runs
 * (and don't re-upload them as a first sync would), then follow the new epoch.
 */
function startEpoch(store: KeyValueStore, state: PendingState, epoch: number): void {
  saveHighScores(store, {});
  state.items = [];
  state.attempts = 0;
  state.nextAttemptAt = 0;
  state.migrated = true;
  savePending(store, state);
  store.set(EPOCH_KEY, String(epoch));
}

/** True when runs are waiting to be sent (cheap: lets the app shell decide to load sync). */
export const hasPendingScores = (store: KeyValueStore) =>
  loadPending(store).items.some((i) => !i.rejected);

export interface SyncedDeps {
  store: KeyValueStore;
  url: string | null;
  getToken(): Promise<TokenResult>;
  clearToken(): void;
  fetchImpl?: typeof fetch;
  now?: () => number;
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Every finished sync, including automatic retries. */
  onResult?: (result: SyncResult) => void;
}

/**
 * Local cache + pending queue + the Worker's shared scores. `hold(true)`
 * while a run is in progress: retries wait until it's released.
 */
export function createSyncedHighScores(deps: SyncedDeps): HighScoreRepository & {
  hold(held: boolean): void;
} {
  const { store, url } = deps;
  const fetchImpl = deps.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let inflight: Promise<SyncResult> | null = null;
  let timer: unknown = null;
  let held = false;
  let retryWhenReleased = false;

  function scheduleRetry(at: number) {
    if (timer !== null) clearTimer(timer);
    timer = setTimer(
      () => {
        timer = null;
        if (held) retryWhenReleased = true;
        else void sync();
      },
      Math.max(0, at - now()),
    );
  }

  /** Sends what's pending, in order; stops at the first failure (`reason`). */
  async function flush(state: PendingState, table: { value: ScoreTable }) {
    const newBest: string[] = [];
    let sent = 0;
    const auth = await deps.getToken();
    if ('error' in auth) return { newBest, sent, reason: auth.error };
    for (const item of state.items.filter((i) => !i.rejected)) {
      // Who played comes from the token on the server, so it isn't sent.
      const { character, score, runId, achievedAt, durationMs } = item;
      const epoch = loadScoreEpoch(store);
      let res: Response;
      try {
        res = await fetchImpl(`${url}/game/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
          body: JSON.stringify({ character, score, runId, achievedAt, durationMs, epoch }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        return { newBest, sent, reason: 'offline' as const };
      }
      if (res.ok) {
        sent++;
        const body = (await res.json().catch(() => null)) as {
          top?: unknown;
          newBest?: unknown;
        } | null;
        state.items = state.items.filter((i) => i.runId !== item.runId);
        if (body?.newBest === true) newBest.push(item.runId);
        try {
          const top = parseScoreTable({ scores: { [character]: body?.top ?? [] } });
          table.value = mergeTables(table.value, top);
        } catch {
          // The listing below brings it in anyway.
        }
      } else if (res.status === HTTP_CONFLICT) {
        // Played before a reset this device hadn't heard of: dropped, never shown as an error.
        const next = epochOf(await res.json().catch(() => null));
        if (next > epoch) {
          startEpoch(store, state, next);
          table.value = {};
          return { newBest, sent, reason: null };
        }
        state.items = state.items.filter((i) => i.runId !== item.runId);
      } else if (res.status === 400 || res.status === 422) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        item.rejected = typeof body?.error === 'string' ? body.error : `Refused (${res.status})`;
      } else {
        if (res.status === 401) deps.clearToken();
        return { newBest, sent, reason: 'offline' as const };
      }
    }
    return { newBest, sent, reason: null };
  }

  async function run(): Promise<SyncResult> {
    const local = { value: loadHighScores(store) };
    const state = loadPending(store);
    if (!state.migrated) {
      // First sync on this device: share the records it already holds.
      const queued = new Set(state.items.map((i) => i.runId));
      for (const [character, list] of Object.entries(local.value))
        for (const entry of list ?? [])
          if (!queued.has(entry.runId))
            state.items.push({ ...entry, character: character as TravelerId });
      state.migrated = true;
      savePending(store, state);
    }

    let offline = false;
    let notJoined = false;
    let newBest: string[] = [];
    let sent = 0;
    const sendable = state.items.some((i) => !i.rejected);
    // Every sync tries at once; the backoff only spaces the automatic retries.
    if (url && sendable) {
      const result = await flush(state, local);
      newBest = result.newBest;
      sent = result.sent;
      // No access (not joined, wrong code, album off): wait for a token, not a timer.
      if (result.reason && result.reason !== 'offline') notJoined = true;
      else if (result.reason) offline = true;
      if (!notJoined) {
        const failed = result.reason !== null;
        state.attempts = failed ? state.attempts + 1 : 0;
        state.nextAttemptAt = failed ? now() + backoffMs(state.attempts, deps.random) : 0;
      }
      savePending(store, state);
    }

    if (url) {
      try {
        const res = await fetchImpl(`${url}/game/scores`, {
          // After sending, skip the short shared cache so our run shows at once.
          cache: sent ? 'no-store' : 'default',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`Scores unavailable (${res.status})`);
        const body: unknown = await res.json();
        const epoch = epochOf(body);
        if (epoch > loadScoreEpoch(store)) {
          startEpoch(store, state, epoch);
          local.value = {};
        }
        local.value = mergeTables(local.value, parseScoreTable(body));
      } catch {
        offline = true;
      }
    }
    saveHighScores(store, local.value);

    const pending = state.items.filter((i) => !i.rejected).length;
    if (pending && !notJoined) scheduleRetry(state.nextAttemptAt);
    return {
      table: local.value,
      state: !url || notJoined ? 'local' : offline ? 'offline' : 'synced',
      newBest,
      pending,
      rejected: state.items.length - pending,
    };
  }

  function sync(): Promise<SyncResult> {
    if (held) {
      // Mid-run: no network. Go as soon as the run is over.
      retryWhenReleased = true;
      const pending = loadPending(store).items.filter((i) => !i.rejected).length;
      return Promise.resolve({
        table: loadHighScores(store),
        state: 'syncing',
        newBest: [],
        pending,
        rejected: 0,
      });
    }
    inflight ??= run()
      .then((result) => {
        deps.onResult?.(result);
        return result;
      })
      .finally(() => (inflight = null));
    return inflight;
  }

  return {
    load: () => loadHighScores(store),
    record(character, entry) {
      const result = recordLocally(store, character, entry);
      if (result.rank >= 0) {
        const state = loadPending(store);
        state.items.push({ ...entry, character });
        savePending(store, state);
      }
      return result;
    },
    sync,
    hold(next) {
      held = next;
      if (!held && retryWhenReleased) {
        retryWhenReleased = false;
        void sync();
      }
    },
  };
}
