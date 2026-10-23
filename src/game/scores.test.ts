import { describe, expect, it } from 'vitest';
import { botInput } from './bot';
import { DEFAULT_PROFILE, HIGH_SCORES_PER_CHARACTER, PRESETS } from './constants';
import { createGameState, score, startGame, step, type GameInput } from './engine';
import { createRng } from './random';
import {
  maxPlausibleScore,
  mergeTables,
  mergeTop,
  parseScoreSubmission,
  parseScoreTable,
  type ScoreEntry,
} from './scores';

const entry = (score: number, at: string, runId: string, playedBy?: 'maya'): ScoreEntry => ({
  score,
  achievedAt: `2027-02-25T${at}:00.000Z`,
  runId,
  ...(playedBy ? { playedBy } : {}),
});

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('merging shared scores', () => {
  it('dedupes by runId, keeps the top five, highest first', () => {
    const local = [entry(500, '10:00', 'run-aaaa'), entry(300, '10:05', 'run-bbbb')];
    const remote = [
      entry(500, '10:00', 'run-aaaa', 'maya'),
      entry(900, '11:00', 'run-cccc'),
      entry(100, '09:00', 'run-dddd'),
      entry(200, '09:30', 'run-eeee'),
      entry(150, '09:40', 'run-ffff'),
    ];
    const merged = mergeTop(local, remote);
    expect(merged).toHaveLength(HIGH_SCORES_PER_CHARACTER);
    expect(merged.map((e) => e.score)).toEqual([900, 500, 300, 200, 150]);
    // The duplicate run kept the copy that knows who played it.
    expect(merged[1]).toMatchObject({ runId: 'run-aaaa', playedBy: 'maya' });
  });

  it('breaks ties in favour of the earlier run', () => {
    const merged = mergeTop([entry(400, '12:00', 'run-late')], [entry(400, '08:00', 'run-early')]);
    expect(merged.map((e) => e.runId)).toEqual(['run-early', 'run-late']);
  });

  it('merges whole tables per character', () => {
    const table = mergeTables(
      { ofek: [entry(100, '10:00', 'run-o1xx')] },
      { ofek: [entry(200, '10:01', 'run-o2xx')], ron: [entry(50, '10:02', 'run-r1xx')] },
    );
    expect(table.ofek!.map((e) => e.score)).toEqual([200, 100]);
    expect(table.ron!.map((e) => e.score)).toEqual([50]);
    expect(table.maya).toBeUndefined();
  });

  it('drops bad entries from the server reply', () => {
    expect(
      parseScoreTable({
        scores: { ofek: [entry(100, '10:00', 'run-o1xx'), { score: 'x' }], stranger: [] },
      }),
    ).toEqual({ ofek: [entry(100, '10:00', 'run-o1xx')] });
  });
});

describe('plausibility', () => {
  const NOW = Date.parse('2027-02-25T12:00:00Z');
  const submit = (over: Record<string, unknown>) =>
    parseScoreSubmission(
      { character: 'ofek', score: 1000, runId: 'run-12345678', durationMs: 60_000, ...over },
      NOW,
    );

  it('never rejects a real run, even a long, lucky one', () => {
    for (const seed of [1, 7, 42, 2027]) {
      const random = seeded(seed);
      const state = createGameState(360, 640);
      startGame(state);
      let input: GameInput = { left: false, right: false };
      for (let i = 0; i < 120 * 300; i++) {
        if (i % 30 === 0) {
          const r = random();
          input = { left: r < 0.33, right: r > 0.66 };
        }
        step(state, input, 1 / 120, random);
        state.lives = DEFAULT_PROFILE.lives.start; // keep going for five minutes
      }
      expect(score(state)).toBeLessThanOrEqual(maxPlausibleScore(state.time));
      expect(submit({ score: score(state), durationMs: Math.round(state.time * 1000) }).ok).toBe(
        true,
      );
    }
  });

  it('accepts a max-effort run with hearts and the magnet always on, on every preset', () => {
    for (const [seed, profile] of Object.values(PRESETS).entries()) {
      const random = createRng(seed + 1);
      const state = createGameState(360, 900, { profile });
      startGame(state);
      let input = botInput(state);
      for (let i = 0; i < 120 * 600; i++) {
        // Never dies, the magnet never runs out, and hearts at the cap score points.
        state.lives = profile.lives.max;
        state.powerUpTime.fill(10);
        if (i % 3 === 0) input = botInput(state);
        step(state, input, 1 / 120, random);
      }
      expect(score(state)).toBeLessThanOrEqual(maxPlausibleScore(state.time));
      expect(submit({ score: score(state), durationMs: Math.round(state.time * 1000) }).ok).toBe(
        true,
      );
    }
  }, 60_000);

  it('rejects scores that are impossible in the reported time (422)', () => {
    expect(submit({ score: maxPlausibleScore(60) + 1 })).toMatchObject({ ok: false, status: 422 });
    expect(submit({ score: 5_000_000, durationMs: 2_000 })).toMatchObject({ status: 422 });
    // Scores from before syncing carry no duration: checked against the longest run.
    expect(submit({ score: 5_000, durationMs: undefined }).ok).toBe(true);
    expect(submit({ score: 50_000_000, durationMs: undefined })).toMatchObject({ status: 422 });
  });

  it('validates the shape (400)', () => {
    for (const bad of [
      { character: 'stranger' },
      { score: 0 },
      { score: 10.5 },
      { runId: 'x' },
      { durationMs: 10 },
      { achievedAt: '2030-01-01T00:00:00Z' },
    ])
      expect(submit(bad)).toMatchObject({ ok: false, status: 400 });
    expect(submit({ achievedAt: '2027-02-25T11:00:00Z' })).toMatchObject({
      ok: true,
      value: { achievedAt: '2027-02-25T11:00:00.000Z' },
    });
  });
});
