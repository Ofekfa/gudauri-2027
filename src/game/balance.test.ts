import { describe, expect, it } from 'vitest';
import { playBotRun, type BotRun } from './bot';
import { createGameState, score, startGame } from './engine';
import { createRng } from './random';

const SEEDS = 30;
const DT = 1 / 120;
/** Every run must be over by then: hearts and the magnet can't make it endless. */
const HARD_LIMIT_S = 15 * 60;
const TARGET_MEDIAN_S = { min: 3 * 60, max: 6 * 60 };
/** Thirty simulated runs take a few seconds. */
const TIMEOUT_MS = 60_000;

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;

describe('balance (scripted bot over fixed seeds)', () => {
  it(
    'lasts 3–6 minutes for a decent player, and every run ends',
    () => {
      const runs: BotRun[] = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const state = createGameState(360, 640);
        startGame(state);
        runs.push(playBotRun(state, createRng(seed), DT, HARD_LIMIT_S, score));
      }
      const seconds = runs.map((r) => r.seconds).sort((a, b) => a - b);
      const scores = runs.map((r) => r.score).sort((a, b) => a - b);
      const report = {
        seconds: {
          min: seconds[0],
          median: quantile(seconds, 0.5),
          p95: quantile(seconds, 0.95),
          max: seconds.at(-1),
        },
        score: {
          min: scores[0],
          median: quantile(scores, 0.5),
          p95: quantile(scores, 0.95),
          max: scores.at(-1),
        },
        heartsPerRun: runs.reduce((n, r) => n + r.hearts, 0) / SEEDS,
        powerUpsPerRun: runs.reduce((n, r) => n + r.powerUps, 0) / SEEDS,
      };
      console.info('balance', JSON.stringify(report));

      expect(report.seconds.median).toBeGreaterThanOrEqual(TARGET_MEDIAN_S.min);
      expect(report.seconds.median).toBeLessThanOrEqual(TARGET_MEDIAN_S.max);
      expect(seconds.at(-1)!).toBeLessThan(HARD_LIMIT_S);
      expect(report.heartsPerRun).toBeGreaterThan(0.5);
      expect(report.powerUpsPerRun).toBeGreaterThan(0.5);
    },
    TIMEOUT_MS,
  );
});
