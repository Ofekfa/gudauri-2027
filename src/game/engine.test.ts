import { describe, expect, it } from 'vitest';
import {
  ENTITY,
  INVULNERABLE_SECONDS,
  LIVES,
  METERS_PER_PX,
  SCORE,
  SKIER,
  SPEED,
} from './constants';
import {
  createGameState,
  score,
  skierScreenY,
  startGame,
  step,
  type GameInput,
  type GameState,
} from './engine';

const W = 360;
const H = 640;
const DT = 1 / 120;
const NONE: GameInput = { left: false, right: false };

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function playing(): GameState {
  const state = createGameState(W, H);
  startGame(state);
  return state;
}

/** Puts one entity so its hitbox is centred on the skier's hitbox. */
function placeOnSkier(state: GameState, kind: GameState['entities'][number]['kind']) {
  const e = state.entities[0]!;
  e.active = true;
  e.kind = kind;
  e.x = state.skierX;
  e.y = state.distance + skierScreenY(state) + SKIER.hitbox.offsetY - ENTITY[kind].hitbox.offsetY;
  // Move the camera-relative spawn horizon far away so no random rows interfere.
  state.nextRowAt = Number.POSITIVE_INFINITY;
  return e;
}

describe('game engine', () => {
  it('does nothing until started', () => {
    const state = createGameState(W, H);
    step(state, NONE, DT, Math.random);
    expect(state.distance).toBe(0);
  });

  it('moves down the slope and speeds up over time, up to the cap', () => {
    const state = playing();
    state.nextRowAt = Number.POSITIVE_INFINITY;
    step(state, NONE, 1, Math.random);
    expect(state.distance).toBeGreaterThan(0);
    expect(state.speed).toBeCloseTo(SPEED.start + SPEED.rampPerSecond);
    for (let i = 0; i < 1000; i++) step(state, NONE, 1, Math.random);
    expect(state.speed).toBe(SPEED.max);
  });

  it('steers with acceleration and stays inside the field', () => {
    const state = playing();
    state.nextRowAt = Number.POSITIVE_INFINITY;
    const start = state.skierX;
    for (let i = 0; i < 12; i++) step(state, { left: false, right: true }, DT, Math.random);
    expect(state.skierX).toBeGreaterThan(start);
    for (let i = 0; i < 1200; i++) step(state, { left: true, right: false }, DT, Math.random);
    expect(state.skierX).toBe(SKIER.edgeMargin);
  });

  it('scores distance in meters plus collectible bonuses', () => {
    const state = playing();
    placeOnSkier(state, 'khachapuri');
    step(state, NONE, DT, Math.random);
    expect(state.collectedThisStep).toBe('khachapuri');
    expect(state.collectedKhachapuri).toBe(1);
    expect(score(state)).toBe(Math.floor(state.distance * METERS_PER_PX) + SCORE.khachapuri);
  });

  it('loses a life on a crash, slows down and is briefly invulnerable', () => {
    const state = playing();
    state.speed = SPEED.max;
    const tree = placeOnSkier(state, 'tree');
    step(state, NONE, DT, Math.random);
    expect(state.crashedThisStep).toBe(true);
    expect(state.lives).toBe(LIVES - 1);
    expect(state.speed).toBeLessThan(SPEED.max);
    // Still overlapping the same tree: no second hit while invulnerable.
    tree.y =
      state.distance + skierScreenY(state) + SKIER.hitbox.offsetY - ENTITY.tree.hitbox.offsetY;
    step(state, NONE, DT, Math.random);
    expect(state.lives).toBe(LIVES - 1);
    expect(state.invulnerableFor).toBeLessThan(INVULNERABLE_SECONDS);
  });

  it('ends the game when the last life is lost', () => {
    const state = playing();
    state.lives = 1;
    placeOnSkier(state, 'rock');
    step(state, NONE, DT, Math.random);
    expect(state.status).toBe('over');
    expect(state.lives).toBe(0);
  });

  it('restarts cleanly after game over', () => {
    const state = playing();
    state.lives = 1;
    placeOnSkier(state, 'flag');
    step(state, NONE, DT, Math.random);
    startGame(state);
    expect(state).toMatchObject({ status: 'playing', lives: LIVES, distance: 0, bonus: 0 });
    expect(state.entities.every((e) => !e.active)).toBe(true);
  });

  it('spawns obstacles ahead, recycles them, and never exceeds the pool', () => {
    const state = playing();
    const random = seeded(1);
    let maxActive = 0;
    // Steer back and forth for a long run, with invulnerability so the game keeps going.
    for (let i = 0; i < 120 * 120; i++) {
      state.invulnerableFor = 1;
      state.lives = LIVES;
      const left = Math.floor(i / 90) % 2 === 0;
      step(state, { left, right: !left }, DT, random);
      maxActive = Math.max(maxActive, state.entities.filter((e) => e.active).length);
    }
    expect(state.distance).toBeGreaterThan(10_000);
    expect(maxActive).toBeGreaterThan(5);
    expect(maxActive).toBeLessThan(state.entities.length);
    // Every active entity is on or below the screen top (old ones are recycled).
    for (const e of state.entities)
      if (e.active) expect(e.y - state.distance).toBeGreaterThan(-100);
  });
});
