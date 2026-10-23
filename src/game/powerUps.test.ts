import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, ENTITY, SCORE, SKIER, type EntityKind } from './constants';
import {
  createGameState,
  powerUpLeft,
  skierScreenY,
  startGame,
  step,
  type Entity,
  type GameInput,
  type GameState,
} from './engine';
import { DEFAULT_POWER_UPS, type PowerUpDef } from './powerUps';
import { createRng } from './random';

const W = 360;
const H = 640;
const DT = 1 / 120;
const NONE: GameInput = { left: false, right: false };
const MAGNET_INDEX = DEFAULT_POWER_UPS.findIndex((d) => d.id === 'magnet');
const MAGNET_SECONDS = DEFAULT_PROFILE.powerUps.magnet.duration;
const RADIUS = DEFAULT_PROFILE.magnetRadius;

function playing(defs?: readonly PowerUpDef[]): GameState {
  const state = createGameState(W, H, defs ? { powerUps: defs } : {});
  startGame(state);
  // No random rows: each test places exactly what it needs.
  state.nextRowAt = Number.POSITIVE_INFINITY;
  return state;
}

/** The point the magnet pulls toward (the skier's hitbox centre), in world y. */
const pullCentre = (state: GameState) => ({
  x: state.skierX,
  y: state.distance + skierScreenY(state) + SKIER.hitbox.offsetY,
});

function put(state: GameState, slot: number, kind: EntityKind, dx: number, dy: number): Entity {
  const e = state.entities[slot]!;
  const c = pullCentre(state);
  Object.assign(e, { active: true, kind, variant: 0, pulled: false, vx: 0, vy: 0, powerUp: -1 });
  e.x = c.x + dx;
  e.y = c.y + dy - ENTITY[kind].hitbox.offsetY;
  return e;
}

const distanceTo = (state: GameState, e: Entity) => {
  const c = pullCentre(state);
  return Math.hypot(e.x - c.x, e.y - c.y);
};

describe('power-ups', () => {
  it('activates on pickup, refreshes to the full duration, then expires', () => {
    const state = playing();
    put(state, 0, 'magnet', 0, 0).powerUp = MAGNET_INDEX;
    step(state, NONE, DT, Math.random);
    expect(state.poweredUpThisStep).toBe(MAGNET_INDEX);
    expect(state.collectedPowerUps).toBe(1);
    expect(powerUpLeft(state, 'magnet')).toBeCloseTo(MAGNET_SECONDS, 1);

    for (let i = 0; i < 120 * 5; i++) step(state, NONE, DT, Math.random);
    expect(powerUpLeft(state, 'magnet')).toBeCloseTo(MAGNET_SECONDS - 5, 1);
    put(state, 0, 'magnet', 0, 0).powerUp = MAGNET_INDEX;
    step(state, NONE, DT, Math.random);
    expect(powerUpLeft(state, 'magnet')).toBeCloseTo(MAGNET_SECONDS, 1);

    for (let i = 0; i < 120 * (MAGNET_SECONDS + 0.1); i++) step(state, NONE, DT, Math.random);
    expect(powerUpLeft(state, 'magnet')).toBe(0);
  });

  it('is extensible: a new definition spawns, activates, runs its effect and expires', () => {
    let ticks = 0;
    const dummy: PowerUpDef = {
      id: 'dummy',
      kind: 'magnet',
      icon: '★',
      label: 'Dummy',
      duration: 3,
      warnSeconds: 1,
      spawn: { perSecond: 50, minSeconds: 0, cooldownSeconds: 1 },
      step: () => void ticks++,
    };
    const state = createGameState(W, H, { powerUps: [dummy] });
    startGame(state);
    const random = createRng(3);
    let spawned: Entity | undefined;
    for (let i = 0; i < 120 * 10 && !spawned; i++) {
      state.invulnerableFor = 1;
      step(state, NONE, DT, random);
      spawned = state.entities.find((e) => e.active && e.powerUp === 0);
    }
    expect(spawned?.kind).toBe('magnet');

    state.nextRowAt = Number.POSITIVE_INFINITY;
    for (const e of state.entities) e.active = false;
    put(state, 0, 'magnet', 0, 0).powerUp = 0;
    step(state, NONE, DT, Math.random);
    expect(powerUpLeft(state, 'dummy')).toBeGreaterThan(2.9);
    for (let i = 0; i < 120 * 4; i++) step(state, NONE, DT, Math.random);
    expect(powerUpLeft(state, 'dummy')).toBe(0);
    expect(ticks).toBeGreaterThan(300);
    expect(ticks).toBeLessThan(380);
  });
});

describe('magnet', () => {
  const withMagnet = () => {
    const state = playing();
    state.powerUpTime[MAGNET_INDEX] = MAGNET_SECONDS;
    return state;
  };

  it('pulls collectibles inside the radius and leaves those just outside', () => {
    const state = withMagnet();
    // The skier moves ~2 px down per step, so allow for that against the radius.
    const inside = put(state, 0, 'snowflake', RADIUS - 4, 0);
    const outside = put(state, 1, 'khachapuri', -(RADIUS + 4), 0);
    step(state, NONE, DT, Math.random);
    expect(inside.pulled).toBe(true);
    expect(outside.pulled).toBe(false);
  });

  it('flies items in smoothly (the gap only shrinks) and collects them, ahead or behind', () => {
    for (const [dx, dy] of [
      [120, 60],
      [-90, -100],
      [0, -120],
    ] as const) {
      const state = withMagnet();
      const item = put(state, 0, 'heart', dx, dy);
      state.lives = 2;
      let last = distanceTo(state, item);
      let steps = 0;
      while (item.active && steps < 240) {
        step(state, NONE, DT, Math.random);
        steps++;
        if (!item.active) break;
        const d = distanceTo(state, item);
        expect(d).toBeLessThanOrEqual(last + 1e-6);
        last = d;
      }
      expect(item.active).toBe(false);
      expect(state.lives).toBe(3);
      // A pull, not a teleport: it takes a visible moment.
      expect(steps).toBeGreaterThan(8);
    }
  });

  it('scores pulled collectibles as usual', () => {
    const state = withMagnet();
    put(state, 0, 'khachapuri', 100, 40);
    for (let i = 0; i < 120; i++) step(state, NONE, DT, Math.random);
    expect(state.collectedKhachapuri).toBe(1);
    expect(state.bonus).toBe(SCORE.khachapuri);
  });

  it('never pulls obstacles or other power-ups', () => {
    const state = withMagnet();
    const tree = put(state, 0, 'tree', 70, 40);
    const other = put(state, 1, 'magnet', -70, 40);
    other.powerUp = MAGNET_INDEX;
    const before = [tree.x, tree.y, other.x, other.y];
    for (let i = 0; i < 30; i++) step(state, NONE, DT, Math.random);
    expect([tree.x, tree.y, other.x, other.y]).toEqual(before);
    expect(tree.pulled || other.pulled).toBe(false);
  });

  it('does nothing when inactive', () => {
    const state = playing();
    const flake = put(state, 0, 'snowflake', 60, 30);
    step(state, NONE, DT, Math.random);
    expect(flake.pulled).toBe(false);
  });
});
