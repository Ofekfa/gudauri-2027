import { describe, expect, it } from 'vitest';
import {
  ENTITY,
  HEARTS,
  INVULNERABLE_SECONDS,
  LIVES,
  MAX_LIVES,
  METERS_PER_PX,
  PICKUP_CLEARANCE,
  SCORE,
  SKIER,
  SPEED,
} from './constants';
import {
  createGameState,
  heartChance,
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

  it('gives a life for a heart, up to the cap, then points instead', () => {
    const state = playing();
    placeOnSkier(state, 'heart');
    step(state, NONE, DT, Math.random);
    expect(state).toMatchObject({ lives: LIVES + 1, lifeGainedThisStep: true, collectedHearts: 1 });
    state.lives = MAX_LIVES;
    placeOnSkier(state, 'heart');
    step(state, NONE, DT, Math.random);
    expect(state).toMatchObject({
      lives: MAX_LIVES,
      lifeGainedThisStep: false,
      collectedHearts: 2,
    });
    expect(state.bonus).toBe(SCORE.heartAtCap);
  });

  it('spawns hearts more often with fewer lives, never at the cap, and less as pressure rises', () => {
    const rowSeconds = 0.5;
    expect(heartChance(1, 0, rowSeconds)).toBeCloseTo(HEARTS.perSecond * rowSeconds);
    expect(heartChance(1, 0, rowSeconds)).toBeGreaterThan(heartChance(3, 0, rowSeconds));
    expect(heartChance(4, 0, rowSeconds)).toBeGreaterThan(0);
    expect(heartChance(MAX_LIVES, 0, rowSeconds)).toBe(0);
    expect(heartChance(1, 1, rowSeconds)).toBeCloseTo(
      heartChance(1, 0, rowSeconds) * HEARTS.lateFactor,
    );
    expect(heartChance(1, 0.5, rowSeconds)).toBeLessThan(heartChance(1, 0, rowSeconds));
  });

  it('never places a heart or power-up inside, or just uphill of, an obstacle', () => {
    const state = playing();
    const random = seeded(7);
    let hearts = 0;
    let powerUps = 0;
    const seen: number[] = [];
    for (let i = 0; i < 120 * 300; i++) {
      // Few lives and no crashes, so hearts keep coming and the run keeps going.
      state.lives = 1;
      state.invulnerableFor = 1;
      state.powerUpTime.fill(0);
      step(state, NONE, DT, random);
      for (const p of state.entities) {
        if (!p.active || (p.kind !== 'heart' && ENTITY[p.kind].role !== 'powerup')) continue;
        for (const o of state.entities) {
          if (!o.active || ENTITY[o.kind].role !== 'obstacle') continue;
          const close =
            Math.abs(o.x - p.x) < PICKUP_CLEARANCE.x && Math.abs(o.y - p.y) < PICKUP_CLEARANCE.y;
          expect(close).toBe(false);
        }
      }
      // Count each new spawn once (pooled entities are reused).
      state.entities.forEach((e, n) => {
        if (!e.active || seen[n] === e.y) return;
        seen[n] = e.y;
        if (e.kind === 'heart') hearts++;
        if (e.powerUp >= 0) powerUps++;
      });
    }
    expect(hearts).toBeGreaterThan(5);
    expect(powerUps).toBeGreaterThan(2);
  });

  it('costs one life for a cluster of obstacles (invulnerable right after a crash)', () => {
    const state = playing();
    placeOnSkier(state, 'tree');
    // A rock a few steps further down the same line.
    const rock = state.entities[1]!;
    Object.assign(rock, { active: true, kind: 'rock', x: state.skierX, variant: 0, powerUp: -1 });
    rock.y = state.entities[0]!.y + 30;
    for (let i = 0; i < 60; i++) step(state, NONE, DT, Math.random);
    expect(state.lives).toBe(LIVES - 1);
  });
});
