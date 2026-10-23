import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TravelerId } from '../data/trip';
import type { TokenResult } from '../lib/album/token';
import { createMemoryStore, type KeyValueStore } from '../lib/storage/safeStorage';
import {
  createLocalHighScores,
  createSyncedHighScores,
  hasPendingScores,
  insertHighScore,
  loadHighScores,
  loadPending,
  loadScoreEpoch,
  type RunRecord,
} from './highScores';
import { mergeTop, type ScoreEntry } from './scores';

const NOW = Date.parse('2027-02-25T10:00:00Z');
const run = (score: number, runId: string, at = NOW): RunRecord => ({
  score,
  runId,
  achievedAt: new Date(at).toISOString(),
  durationMs: 60_000,
});

/** A stand-in for the Worker: keeps every run, answers top five per character. */
function fakeServer() {
  const runs: (ScoreEntry & { character: TravelerId })[] = [];
  let online = true;
  let refuse: number | null = null;
  let epoch = 1;
  const posted: string[] = [];
  /** A character's top five, without the server-only `character` field. */
  const top = (c: TravelerId): ScoreEntry[] =>
    mergeTop(runs.filter((r) => r.character === c)).map(
      ({ score, runId, achievedAt, playedBy }) => ({
        score,
        runId,
        achievedAt,
        ...(playedBy ? { playedBy } : {}),
      }),
    );
  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
    if (!online) throw new TypeError('Failed to fetch');
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as RunRecord & { character: TravelerId };
      posted.push(body.runId);
      if (refuse) return new Response(JSON.stringify({ error: 'Nope' }), { status: refuse });
      if (((body as { epoch?: number }).epoch ?? 1) < epoch)
        return new Response(JSON.stringify({ error: 'The scores were reset', epoch }), {
          status: 409,
        });
      const known = runs.find((r) => r.runId === body.runId);
      const best = top(body.character)[0];
      if (!known)
        runs.push({
          character: body.character,
          score: body.score,
          runId: body.runId,
          achievedAt: body.achievedAt,
          playedBy: 'maya',
        });
      return new Response(
        JSON.stringify({
          character: body.character,
          top: top(body.character),
          newBest: !known && (!best || body.score > best.score),
        }),
        { status: known ? 200 : 201 },
      );
    }
    const scores = Object.fromEntries(
      (['ofek', 'ron', 'roy', 'maya'] as const).map((c) => [c, top(c)]),
    );
    return new Response(JSON.stringify({ scores, epoch }));
  });
  return {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    calls: fetchImpl,
    runs,
    posted,
    setOnline: (v: boolean) => (online = v),
    refuseWith: (status: number | null) => (refuse = status),
    /** What `npm run scores:reset` does: every run gone, epoch raised. */
    reset: (next: number) => {
      runs.length = 0;
      epoch = next;
    },
  };
}

function device(server: ReturnType<typeof fakeServer>, store: KeyValueStore = createMemoryStore()) {
  let token: TokenResult = { token: 't' };
  const repo = createSyncedHighScores({
    store,
    url: 'https://w',
    getToken: async () => token,
    clearToken: vi.fn(),
    fetchImpl: server.fetchImpl,
    now: () => Date.now(),
    random: () => 0.5,
  });
  return { repo, store, setToken: (t: TokenResult) => (token = t) };
}

describe('insertHighScore', () => {
  const e = (score: number, runId: string, at = NOW) => ({
    score,
    runId,
    achievedAt: new Date(at).toISOString(),
  });

  it('keeps the top five sorted, reports the rank, and ignores zero', () => {
    let list: ScoreEntry[] = [];
    for (const [score, id] of [
      [100, 'run-a'],
      [300, 'run-b'],
      [200, 'run-c'],
    ] as const)
      list = insertHighScore(list, e(score, `${id}xxxxx`)).list;
    expect(list.map((s) => s.score)).toEqual([300, 200, 100]);
    expect(insertHighScore(list, e(250, 'run-dxxxxx')).rank).toBe(1);
    expect(insertHighScore(list, e(0, 'run-exxxxx')).rank).toBe(-1);
  });

  it('breaks ties in favour of the earlier score', () => {
    const { rank } = insertHighScore([e(100, 'run-first1', NOW)], e(100, 'run-later1', NOW + 1));
    expect(rank).toBe(1);
  });
});

describe('local high scores', () => {
  it('migrates the old format once, with stable ids, and survives corrupt data', () => {
    const store = createMemoryStore();
    store.set('game:highScores', JSON.stringify({ maya: [{ score: 420, at: 1_700_000_000_000 }] }));
    const table = loadHighScores(store);
    expect(table.maya).toEqual([
      {
        score: 420,
        achievedAt: '2023-11-14T22:13:20.000Z',
        runId: 'legacy-maya-1700000000000-420',
      },
    ]);
    expect(loadHighScores(store)).toEqual(table);
    store.set('game:highScores', '{oops');
    expect(loadHighScores(store)).toEqual({});
  });

  it('records on this device only', async () => {
    const repo = createLocalHighScores(createMemoryStore());
    const result = repo.record('ron', run(500, 'run-local01'));
    expect(result).toMatchObject({ rank: 0, beatsLocalBest: true });
    expect((await repo.sync()).state).toBe('local');
    expect(repo.load().ron![0]!.score).toBe(500);
  });
});

describe('synced high scores', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  it('shares a record: phone A sets it, phone B sees it', async () => {
    const server = fakeServer();
    const a = device(server);
    const b = device(server);
    const recorded = a.repo.record('ofek', run(1200, 'run-ofek0001'));
    expect(recorded.beatsLocalBest).toBe(true);
    const synced = await a.repo.sync();
    expect(synced).toMatchObject({ state: 'synced', newBest: ['run-ofek0001'], pending: 0 });
    const onB = await b.repo.sync();
    expect(onB.table.ofek![0]).toMatchObject({ score: 1200, playedBy: 'maya' });
    // B's own run beats B's (empty) local list but not the shared best.
    expect(b.repo.record('ofek', run(900, 'run-ofek0002')).beatsLocalBest).toBe(false);
    expect((await b.repo.sync()).newBest).toEqual([]);
  });

  it('uploads the scores a device already had, once (one-time migration)', async () => {
    const server = fakeServer();
    const store = createMemoryStore();
    store.set('game:highScores', JSON.stringify({ roy: [{ score: 300, at: NOW - 1000 }] }));
    const { repo } = device(server, store);
    await repo.sync();
    await repo.sync();
    expect(server.posted).toEqual([`legacy-roy-${NOW - 1000}-300`]);
    expect(server.runs.map((r) => r.score)).toEqual([300]);
  });

  it('keeps runs made offline, retries with backoff, and sends them when back', async () => {
    const server = fakeServer();
    const { repo, store } = device(server);
    server.setOnline(false);
    repo.record('maya', run(800, 'run-maya0001'));
    const offline = await repo.sync();
    expect(offline).toMatchObject({ state: 'offline', pending: 1 });
    expect(offline.table.maya![0]!.score).toBe(800);
    expect(loadPending(store)).toMatchObject({ attempts: 1 });
    expect(hasPendingScores(store)).toBe(true);
    // The retry waits (2 s, then 4 s…), and stays pending while offline.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(loadPending(store).attempts).toBe(2);
    server.setOnline(true);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(loadPending(store).items).toEqual([]);
    expect(server.runs.map((r) => r.runId)).toEqual(['run-maya0001']);
  });

  it('waits for an album token, then flushes', async () => {
    const server = fakeServer();
    const d = device(server);
    d.setToken({ error: 'not-joined' });
    d.repo.record('ron', run(400, 'run-ron00001'));
    expect(await d.repo.sync()).toMatchObject({ state: 'local', pending: 1 });
    // No timer while there's no access: nothing goes out until a token arrives.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(server.posted).toEqual([]);
    d.setToken({ token: 't' });
    expect(await d.repo.sync()).toMatchObject({ state: 'synced', pending: 0 });
    expect(server.posted).toEqual(['run-ron00001']);
  });

  it('keeps refused runs on the device and stops re-sending them', async () => {
    const server = fakeServer();
    const { repo, store } = device(server);
    server.refuseWith(422);
    repo.record('ofek', run(999, 'run-ofek0009'));
    expect(await repo.sync()).toMatchObject({ rejected: 1, pending: 0 });
    expect(loadPending(store).items[0]).toMatchObject({ rejected: 'Nope' });
    expect(repo.load().ofek![0]!.runId).toBe('run-ofek0009');
    server.refuseWith(null);
    await repo.sync();
    expect(server.posted).toEqual(['run-ofek0009']);
  });

  it('never syncs during a run: a due retry waits until the run is over', async () => {
    const server = fakeServer();
    const { repo } = device(server);
    server.setOnline(false);
    repo.record('roy', run(100, 'run-roy00001'));
    await repo.sync();
    server.setOnline(true);
    repo.hold(true);
    const before = server.calls.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    // Coming back online mid-run asks for a sync too: it waits as well.
    expect((await repo.sync()).state).toBe('syncing');
    expect(server.calls.mock.calls.length).toBe(before);
    repo.hold(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.posted).toEqual(['run-roy00001']);
  });
});

describe('score resets (epochs)', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  it('a device with old records and an unsent run drops them all and shows the fresh scores', async () => {
    const server = fakeServer();
    const store = createMemoryStore();
    // Pre-sync records (never uploaded) plus a synced history and an unsent run.
    store.set('game:highScores', JSON.stringify({ roy: [{ score: 300, at: NOW - 5000 }] }));
    const phone = device(server, store);
    await phone.repo.sync();
    server.setOnline(false);
    phone.repo.record('ofek', run(800, 'run-ofek0old'));
    await phone.repo.sync();
    expect(loadPending(store).items).toHaveLength(1);

    server.reset(2);
    server.setOnline(true);
    const postedBefore = server.posted.length;
    const after = await phone.repo.sync();
    expect(after.table).toEqual({});
    expect(after.pending).toBe(0);
    expect(loadHighScores(store)).toEqual({});
    expect(loadPending(store)).toMatchObject({ items: [], migrated: true });
    expect(loadScoreEpoch(store)).toBe(2);
    // The queued old run was refused once (409) and nothing old reached the server.
    expect(server.posted.length - postedBefore).toBe(1);
    expect(server.runs).toEqual([]);
    // Later syncs never re-upload anything.
    await phone.repo.sync();
    expect(server.posted.length - postedBefore).toBe(1);
  });

  it('learns the new epoch from the listing even without access, and skips the first upload', async () => {
    const server = fakeServer();
    server.reset(2);
    const store = createMemoryStore();
    store.set('game:highScores', JSON.stringify({ maya: [{ score: 420, at: NOW - 1000 }] }));
    const phone = device(server, store);
    phone.setToken({ error: 'not-joined' });
    const result = await phone.repo.sync();
    expect(result).toMatchObject({ table: {}, pending: 0 });
    expect(loadPending(store)).toMatchObject({ items: [], migrated: true });
    phone.setToken({ token: 't' });
    await phone.repo.sync();
    expect(server.posted).toEqual([]);
  });

  it('a new score after the reset syncs normally and shows on another phone', async () => {
    const server = fakeServer();
    const a = device(server);
    const b = device(server);
    a.repo.record('ron', run(500, 'run-ron0old1'));
    await a.repo.sync();
    server.reset(2);
    await a.repo.sync();
    await b.repo.sync();
    a.repo.record('ron', run(150, 'run-ron0new1'));
    expect(await a.repo.sync()).toMatchObject({ state: 'synced', newBest: ['run-ron0new1'] });
    expect((await b.repo.sync()).table.ron!.map((e) => e.score)).toEqual([150]);
    expect(server.runs.map((r) => r.runId)).toEqual(['run-ron0new1']);
  });
});
