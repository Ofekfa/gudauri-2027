import { describe, expect, it } from 'vitest';
import { playBotRun, type BotRun } from './bot';
import { DEFAULT_PROFILE, PRESETS, type DifficultyProfile } from './constants';
import { createGameState, score, startGame } from './engine';
import { createRng } from './random';

const SEEDS = 30;
const DT = 1 / 120;
/** Every run must be over by then: hearts and the magnet can't make it endless. */
const HARD_LIMIT_S = 15 * 60;
/** Thirty simulated runs take a few seconds. */
const TIMEOUT_MS = 60_000;
/** Target for a decent player (the bot) on the default profile. */
const TARGET_MEDIAN_S = { min: 2 * 60, max: 3.5 * 60 };
/**
 * Median for the original game (v1.14.0, before hearts and power-ups),
 * measured with this bot over seeds 1–60. Its code is gone, so it's a number.
 */
const ORIGINAL_MEDIAN_S = 57;
const MAX_POWER_UPS_PER_RUN = 4;

const NEVER = { perSecond: 0, minSeconds: 0, cooldownSeconds: 0 };

/** v1.15.0's balance (slow and generous), kept to prove the retune is harder. */
const V1_15_PROFILE: DifficultyProfile = {
  name: 'v1.15.0',
  speed: { start: 240, cruise: 640, max: 640, earlyRamp: 1.5, lateRamp: 1.5, crashFactor: 0.55 },
  density: {
    rowGapStart: 150,
    rowGapMin: 75,
    maxItemsPerRowStart: 2,
    maxItemsPerRowEnd: 4,
    collectibleChance: 0.22,
    collectibleChanceEnd: 0.16,
    fullAfterSeconds: 720,
  },
  hearts: { perSecond: 1 / 14, lateFactor: 0.15, minGapSeconds: 8 },
  powerUps: {
    magnet: { duration: 8, spawn: { perSecond: 1 / 30, minSeconds: 15, cooldownSeconds: 25 } },
    // v1.15.0 had only the magnet.
    shield: { duration: 0, spawn: NEVER },
    slowmo: { duration: 0, spawn: NEVER },
    double: { duration: 0, spawn: NEVER },
  },
  magnetRadius: 150,
  invulnerableSeconds: 1.6,
  lives: { start: 3, max: 5 },
};

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;

function simulate(profile: DifficultyProfile) {
  const runs: BotRun[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const state = createGameState(360, 640, { profile });
    startGame(state);
    runs.push(playBotRun(state, createRng(seed), DT, HARD_LIMIT_S, score));
  }
  const seconds = runs.map((r) => r.seconds).sort((a, b) => a - b);
  return {
    seconds,
    median: quantile(seconds, 0.5),
    p90: quantile(seconds, 0.9),
    medianScore: quantile(
      runs.map((r) => r.score).sort((a, b) => a - b),
      0.5,
    ),
    heartsPerRun: runs.reduce((n, r) => n + r.hearts, 0) / SEEDS,
    powerUpsPerRun: runs.reduce((n, r) => n + r.powerUps, 0) / SEEDS,
  };
}

describe('balance (scripted bot over fixed seeds)', () => {
  it(
    'the default lasts 2–3.5 minutes: harder than v1.15.0, easier than the original',
    () => {
      const now = simulate(DEFAULT_PROFILE);
      const before = simulate(V1_15_PROFILE);
      console.info(
        'balance',
        JSON.stringify({ default: now, v1_15: before }, (k, v) =>
          k === 'seconds' ? undefined : v,
        ),
      );
      expect(now.median).toBeGreaterThanOrEqual(TARGET_MEDIAN_S.min);
      expect(now.median).toBeLessThanOrEqual(TARGET_MEDIAN_S.max);
      expect(now.median).toBeGreaterThan(ORIGINAL_MEDIAN_S);
      expect(now.median).toBeLessThan(before.median);
      // Hearts and the magnet still matter, just less generously.
      expect(now.heartsPerRun).toBeGreaterThan(1);
      expect(now.heartsPerRun).toBeLessThan(before.heartsPerRun);
      // Four kinds now (v1.15.0 had only the magnet): a few per run, not a constant stream.
      expect(now.powerUpsPerRun).toBeGreaterThan(1);
      expect(now.powerUpsPerRun).toBeLessThan(MAX_POWER_UPS_PER_RUN);
      expect(now.seconds.at(-1)!).toBeLessThan(HARD_LIMIT_S);
    },
    TIMEOUT_MS,
  );

  it(
    'every trial preset sits between the original and v1.15.0, and every run ends',
    () => {
      const before = simulate(V1_15_PROFILE).median;
      for (const profile of Object.values(PRESETS)) {
        const { median, seconds } = simulate(profile);
        expect(median, profile.name).toBeGreaterThan(ORIGINAL_MEDIAN_S);
        expect(median, profile.name).toBeLessThan(before);
        expect(seconds.at(-1)!, profile.name).toBeLessThan(HARD_LIMIT_S);
      }
    },
    TIMEOUT_MS,
  );
});
