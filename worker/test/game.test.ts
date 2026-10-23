import { describe, expect, it, vi } from 'vitest';
import { HIGH_SCORES_PER_CHARACTER } from '../../src/game/constants';
import { maxPlausibleScore, type ScoreEntry } from '../../src/game/scores';
import { applyEpoch, listScores, memoryScoresDb, submitScore } from '../src/game/logic';
import type { Env } from '../src/env';
import { handleRequest } from '../src/index';
import type { ScoresStub } from '../src/routes/game';

const ORIGIN = 'https://ofekfa.github.io';
const CODE = 'khinkali-at-midnight';
const NOW = Date.parse('2027-02-25T10:00:00Z');

function setup(over: Partial<Env> = {}, db = memoryScoresDb()) {
  const stub: ScoresStub = {
    list: async (limit, epoch) => listScores(db, epoch, limit),
    submit: async (submission, playedBy, epoch) => submitScore(db, submission, playedBy, epoch),
  };
  const env: Env = {
    AI: { run: vi.fn() },
    RL_DATA: { limit: vi.fn().mockResolvedValue({ success: true }) },
    RL_AUTH: { limit: vi.fn().mockResolvedValue({ success: true }) },
    ALLOWED_ORIGINS: ORIGIN,
    MODEL: 'm',
    GROUP_CODE: CODE,
    ALBUM_SIGNING_KEY: 'test-signing-key-123',
    // The album binding only has to exist for tokens to be issued.
    ALBUM: { idFromName: (n: string) => n, get: () => ({}) as never },
    SCORES: { idFromName: (n: string) => n, get: () => stub },
    ...over,
  };
  const call = (path: string, init: RequestInit & { token?: string } = {}) => {
    const headers = new Headers(init.headers);
    headers.set('Origin', ORIGIN);
    if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
    return handleRequest(
      new Request(`https://w.example${path}`, { ...init, headers }),
      env,
      new Date(NOW),
    );
  };
  const session = async (who = 'maya') => {
    const res = await call('/album/session', {
      method: 'POST',
      body: JSON.stringify({ code: CODE, who }),
    });
    return ((await res.json()) as { token: string }).token;
  };
  let n = 0;
  const run = (over: Record<string, unknown> = {}) => ({
    character: 'ofek',
    score: 1000,
    durationMs: 60_000,
    runId: `run-${String(++n).padStart(8, '0')}`,
    ...over,
  });
  const post = (token: string, body: unknown) =>
    call('/game/scores', { method: 'POST', token, body: JSON.stringify(body) });
  type Reply = { character: string; top: ScoreEntry[]; newBest: boolean };
  return {
    env,
    call,
    session,
    run,
    post,
    db,
    reply: async (r: Response) => (await r.json()) as Reply,
  };
}

describe('GET /game/scores', () => {
  it('is public, short-cached, and lists the top five per character', async () => {
    const { call, session, post, run } = setup();
    const token = await session();
    for (const score of [100, 700, 300, 900, 500, 200, 800]) await post(token, run({ score }));
    await post(token, run({ character: 'ron', score: 50 }));
    const res = await call('/game/scores');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=20');
    const { scores } = (await res.json()) as { scores: Record<string, ScoreEntry[]> };
    expect(scores.ofek!.map((e) => e.score)).toEqual([900, 800, 700, 500, 300]);
    expect(scores.ofek).toHaveLength(HIGH_SCORES_PER_CHARACTER);
    expect(scores.ron!.map((e) => e.score)).toEqual([50]);
  });
});

describe('POST /game/scores', () => {
  it('needs an album token and the album to be set up', async () => {
    const { post, run } = setup();
    expect((await post('', run())).status).toBe(401);
    expect((await post('forged.token', run())).status).toBe(401);
    const off = setup({ ALBUM_SIGNING_KEY: undefined });
    expect((await off.post('x', off.run())).status).toBe(501);
  });

  it('stores the run with who played it (from the token) and flags a new shared best', async () => {
    const { post, run, session, reply } = setup();
    const roy = await session('roy');
    const first = await post(roy, run({ score: 500, playedBy: 'maya' }));
    expect(first.status).toBe(201);
    const body = await reply(first);
    expect(body).toMatchObject({ character: 'ofek', newBest: true });
    expect(body.top[0]).toMatchObject({ score: 500, playedBy: 'roy' });
    expect((await reply(await post(roy, run({ score: 400 })))).newBest).toBe(false);
    // A tie doesn't beat the earlier record.
    expect((await reply(await post(roy, run({ score: 500 })))).newBest).toBe(false);
    expect((await reply(await post(roy, run({ score: 501 })))).newBest).toBe(true);
  });

  it('is idempotent by runId: a retry never duplicates and keeps its answer', async () => {
    const { post, run, session, reply, call } = setup();
    const token = await session();
    const once = run({ score: 750 });
    expect((await post(token, once)).status).toBe(201);
    const again = await post(token, once);
    expect(again.status).toBe(200);
    expect((await reply(again)).newBest).toBe(true);
    const { scores } = (await (await call('/game/scores')).json()) as {
      scores: Record<string, ScoreEntry[]>;
    };
    expect(scores.ofek).toHaveLength(1);
  });

  it('validates input (400) and rejects impossible scores (422)', async () => {
    const { post, run, session, call } = setup();
    const token = await session();
    for (const bad of [
      run({ character: 'stranger' }),
      run({ score: -5 }),
      run({ score: 12.5 }),
      run({ runId: '../../' }),
      run({ durationMs: 5 }),
    ])
      expect((await post(token, bad)).status).toBe(400);
    expect((await call('/game/scores', { method: 'POST', token, body: '{not json' })).status).toBe(
      400,
    );
    expect(
      (await post(token, run({ score: maxPlausibleScore(10) + 1, durationMs: 10_000 }))).status,
    ).toBe(422);
    expect((await post(token, run({ score: 9_999_999 }))).status).toBe(422);
  });

  it('accepts long runs up to the bound (hearts and the magnet make 10-minute runs possible)', async () => {
    const { post, run, session } = setup();
    const token = await session();
    const tenMinutes = 600_000;
    const best = maxPlausibleScore(tenMinutes / 1000);
    expect((await post(token, run({ score: best, durationMs: tenMinutes }))).status).toBe(201);
    expect((await post(token, run({ score: best + 1, durationMs: tenMinutes }))).status).toBe(422);
  });

  it('is rate limited per IP', async () => {
    const limited = setup({ RL_DATA: { limit: vi.fn().mockResolvedValue({ success: false }) } });
    const token = await limited.session();
    const res = await limited.post(token, limited.run());
    expect(res.status).toBe(429);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('never loses a score when many phones submit at once', async () => {
    const { post, run, session, call } = setup();
    const tokens = await Promise.all(['ofek', 'ron', 'roy', 'maya'].map((w) => session(w)));
    const runs = Array.from({ length: 20 }, (_, i) => run({ score: 100 + i * 10 }));
    const statuses = await Promise.all(
      runs.map((r, i) => post(tokens[i % 4]!, r).then((x) => x.status)),
    );
    expect(statuses.every((s) => s === 201)).toBe(true);
    const { scores } = (await (await call('/game/scores')).json()) as {
      scores: Record<string, ScoreEntry[]>;
    };
    expect(scores.ofek!.map((e) => e.score)).toEqual([290, 280, 270, 260, 250]);
  });

  it('accepts scores from before syncing without a duration, within the absolute bound', async () => {
    const { post, session } = setup();
    const token = await session();
    const legacy = {
      character: 'maya',
      score: 1234,
      runId: 'legacy-maya-1700000000000-1234',
      achievedAt: '2026-10-01T10:00:00Z',
    };
    const res = await post(token, legacy);
    expect(res.status).toBe(201);
    expect(((await res.json()) as { top: ScoreEntry[] }).top[0]!.achievedAt).toBe(
      '2026-10-01T10:00:00.000Z',
    );
  });

  it('allows the browser preflight with Authorization', async () => {
    const { call } = setup();
    const res = await call('/game/scores', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });
});

describe('score epochs (resets)', () => {
  type Listing = {
    scores: Record<string, ScoreEntry[]>;
    epoch: number;
    runs: Record<string, number>;
  };
  const listing = async (call: ReturnType<typeof setup>['call']) =>
    (await (await call('/game/scores')).json()) as Listing;

  it('GET reports the epoch in force and how many runs each character has', async () => {
    const { call, session, post, run } = setup({ SCORE_EPOCH: '3' });
    const token = await session();
    for (const score of [100, 200, 300, 400, 500, 600]) await post(token, run({ score, epoch: 3 }));
    const body = await listing(call);
    expect(body.epoch).toBe(3);
    expect(body.runs).toEqual({ ofek: 6 });
    expect(body.scores.ofek).toHaveLength(HIGH_SCORES_PER_CHARACTER);
  });

  it('defaults to epoch 1 and accepts runs that carry no epoch (older apps)', async () => {
    const { call, session, post, run } = setup();
    const token = await session();
    expect((await post(token, run({ score: 120 }))).status).toBe(201);
    expect((await listing(call)).epoch).toBe(1);
  });

  it('raising SCORE_EPOCH deletes every run; old-epoch runs then get 409; new ones sync', async () => {
    const before = setup();
    const token = await before.session();
    await before.post(token, before.run({ score: 900 }));
    await before.post(token, before.run({ character: 'maya', score: 700 }));
    // Same store, next deploy with the epoch raised.
    const after = setup({ SCORE_EPOCH: '2' }, before.db);
    expect(await listing(after.call)).toEqual({ scores: {}, epoch: 2, runs: {} });

    const old = await after.post(token, after.run({ score: 950 }));
    expect(old.status).toBe(409);
    expect(await old.json()).toMatchObject({ epoch: 2 });
    expect((await after.post(token, after.run({ score: 960, epoch: 1 }))).status).toBe(409);

    const fresh = await after.post(token, after.run({ score: 140, epoch: 2 }));
    expect(fresh.status).toBe(201);
    expect(await after.reply(fresh)).toMatchObject({ newBest: true });
    expect((await listing(after.call)).scores.ofek!.map((e) => e.score)).toEqual([140]);
    // Going back to a lower epoch never undoes the reset.
    expect((await listing(setup({ SCORE_EPOCH: '1' }, before.db).call)).epoch).toBe(2);
  });

  it('logs every run before deleting (a full backup in `wrangler tail`)', () => {
    const db = memoryScoresDb();
    applyEpoch(db, 1);
    submitScore(
      db,
      {
        character: 'roy',
        score: 300,
        runId: 'run-0000aaaa',
        achievedAt: '2027-02-25T10:00:00.000Z',
      },
      'roy',
    );
    const lines: string[] = [];
    expect(applyEpoch(db, 2, (l) => lines.push(l))).toBe(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      event: 'scores-reset',
      from: 1,
      to: 2,
      runs: [{ runId: 'run-0000aaaa', score: 300, character: 'roy' }],
    });
    expect(db.allRuns()).toEqual([]);
  });

  it('rejects a malformed epoch (400)', async () => {
    const { session, post, run } = setup();
    const token = await session();
    for (const epoch of [0, -1, 1.5, 'two'])
      expect((await post(token, run({ epoch }))).status).toBe(400);
  });
});
