import { describe, expect, it } from 'vitest';
import {
  ENTITY,
  FIXED_STEP,
  MAGNET,
  MIN_REACTION_SECONDS,
  OBSTACLE_KINDS,
  PRESETS,
  SKIER,
  SKIER_Y_RATIO,
  type DifficultyProfile,
} from './constants';
import { createGameState, skierScreenY, startGame, step, type GameInput } from './engine';

const NONE: GameInput = { left: false, right: false };
const PROFILES: DifficultyProfile[] = Object.values(PRESETS);
/** The shortest play field CSS allows (min-height: 22rem). */
const MIN_FIELD_HEIGHT = 352;

describe('fair at speed (every preset)', () => {
  it('never moves further per step than the thinnest hitbox overlap (no tunnelling)', () => {
    const thinnest = Math.min(...OBSTACLE_KINDS.map((k) => ENTITY[k].hitbox.height));
    const thinnestPickup = Math.min(
      ...Object.values(ENTITY)
        .filter((e) => e.role !== 'obstacle')
        .map((e) => e.hitbox.height),
    );
    for (const p of PROFILES) {
      expect(p.speed.max * FIXED_STEP, p.name).toBeLessThan(SKIER.hitbox.height + thinnest);
      // Magnet-pulled items close in faster, and land on the skier when they'd overshoot.
      expect((p.speed.max + MAGNET.maxSpeed) * FIXED_STEP, p.name).toBeLessThan(
        SKIER.hitbox.height + thinnestPickup,
      );
    }
  });

  it('always hits an obstacle in the lane at top speed, whatever the sub-step phase', () => {
    for (const p of PROFILES) {
      const travel = p.speed.max * FIXED_STEP;
      for (const kind of ['flag', 'rock', 'tree'] as const) {
        for (let phase = 0; phase < 1; phase += 0.125) {
          const state = createGameState(360, 900, { profile: p });
          startGame(state);
          state.nextRowAt = Number.POSITIVE_INFINITY;
          state.speed = p.speed.max;
          const e = state.entities[0]!;
          Object.assign(e, { active: true, kind, x: state.skierX, variant: 0, powerUp: -1 });
          // A few steps ahead, offset by a fraction of one step's travel.
          e.y =
            state.distance +
            skierScreenY(state) +
            SKIER.hitbox.offsetY -
            ENTITY[kind].hitbox.offsetY +
            travel * (5 + phase);
          let crashed = false;
          for (let i = 0; i < 20 && !crashed; i++) {
            step(state, NONE, FIXED_STEP, Math.random);
            crashed = state.crashedThisStep;
          }
          expect(crashed, `${p.name} ${kind} ${phase}`).toBe(true);
        }
      }
    }
  });

  it('keeps obstacles on screen long enough to react, even on the shortest field', () => {
    for (const p of PROFILES) {
      for (const height of [MIN_FIELD_HEIGHT, 500, 640, 900]) {
        const state = createGameState(375, height, { profile: p });
        const visibleAhead = height * (1 - SKIER_Y_RATIO);
        expect(visibleAhead / state.speedCap, `${p.name} @${height}`).toBeGreaterThanOrEqual(
          MIN_REACTION_SECONDS - 1e-9,
        );
        expect(state.speedCap).toBeLessThanOrEqual(p.speed.max);
        // The ramp honours the cap.
        startGame(state);
        state.nextRowAt = Number.POSITIVE_INFINITY;
        for (let i = 0; i < 120 * 600; i += 120) step(state, NONE, 1, Math.random);
        expect(state.speed).toBeLessThanOrEqual(state.speedCap);
      }
    }
  });

  it('can steer clear of an obstacle within the reaction window at top speed', () => {
    const widest = Math.max(...OBSTACLE_KINDS.map((k) => ENTITY[k].hitbox.width));
    const needed = (SKIER.hitbox.width + widest) / 2;
    for (const p of PROFILES) {
      const state = createGameState(375, MIN_FIELD_HEIGHT, { profile: p });
      startGame(state);
      state.nextRowAt = Number.POSITIVE_INFINITY;
      state.speed = state.speedCap;
      const x0 = state.skierX;
      const steps = Math.floor(MIN_REACTION_SECONDS / FIXED_STEP);
      for (let i = 0; i < steps; i++)
        step(state, { left: false, right: true }, FIXED_STEP, Math.random);
      expect(state.skierX - x0, p.name).toBeGreaterThan(needed * 2);
    }
  });
});
