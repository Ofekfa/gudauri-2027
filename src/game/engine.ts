/**
 * Pure game simulation: no DOM, no timers. Mutates state in place and never
 * allocates during `step`, so the render loop stays smooth on phones.
 */
import {
  DESPAWN_ABOVE,
  ENTITY,
  INVULNERABLE_SECONDS,
  LIVES,
  METERS_PER_PX,
  OBSTACLE_KINDS,
  POOL_SIZE,
  SCORE,
  SKIER,
  SKIER_Y_RATIO,
  SPAWN,
  SPEED,
  TRAIL,
  type EntityKind,
} from './constants';

export type Random = () => number;

export interface Entity {
  active: boolean;
  kind: EntityKind;
  /** Center x in field coordinates. */
  x: number;
  /** World y: distance down the slope. */
  y: number;
  /** Variation index for drawing (e.g. flag colour). */
  variant: number;
}

export type GameStatus = 'ready' | 'playing' | 'over';

export interface GameInput {
  left: boolean;
  right: boolean;
}

export interface GameState {
  width: number;
  height: number;
  status: GameStatus;
  time: number;
  /** Camera position: world y at the top of the view. */
  distance: number;
  speed: number;
  skierX: number;
  skierVx: number;
  lives: number;
  invulnerableFor: number;
  bonus: number;
  collectedKhachapuri: number;
  collectedSnowflakes: number;
  nextRowAt: number;
  entities: Entity[];
  /** Ski-track ring buffer: x and world-y pairs. */
  trail: Float32Array;
  trailHead: number;
  trailCount: number;
  nextTrailAt: number;
  /** Set during a step so the UI can react (sound, vibration, announcements). */
  crashedThisStep: boolean;
  collectedThisStep: EntityKind | null;
}

export function createGameState(width: number, height: number): GameState {
  const entities: Entity[] = Array.from({ length: POOL_SIZE }, () => ({
    active: false,
    kind: 'tree',
    x: 0,
    y: 0,
    variant: 0,
  }));
  const state: GameState = {
    width,
    height,
    status: 'ready',
    time: 0,
    distance: 0,
    speed: SPEED.start,
    skierX: width / 2,
    skierVx: 0,
    lives: LIVES,
    invulnerableFor: 0,
    bonus: 0,
    collectedKhachapuri: 0,
    collectedSnowflakes: 0,
    nextRowAt: 0,
    entities,
    trail: new Float32Array(TRAIL.length * 2),
    trailHead: 0,
    trailCount: 0,
    nextTrailAt: 0,
    crashedThisStep: false,
    collectedThisStep: null,
  };
  resetGame(state);
  return state;
}

/** Back to the start line, reusing all allocations. */
export function resetGame(state: GameState): void {
  state.status = 'ready';
  state.time = 0;
  state.distance = 0;
  state.speed = SPEED.start;
  state.skierX = state.width / 2;
  state.skierVx = 0;
  state.lives = LIVES;
  state.invulnerableFor = 0;
  state.bonus = 0;
  state.collectedKhachapuri = 0;
  state.collectedSnowflakes = 0;
  // First row appears just below the view, leaving a clear run-in.
  state.nextRowAt = state.height + SPAWN.belowView;
  for (const e of state.entities) e.active = false;
  state.trailHead = 0;
  state.trailCount = 0;
  state.nextTrailAt = 0;
  state.crashedThisStep = false;
  state.collectedThisStep = null;
}

export function resizeGame(state: GameState, width: number, height: number): void {
  state.width = width;
  state.height = height;
  state.skierX = clamp(state.skierX, SKIER.edgeMargin, width - SKIER.edgeMargin);
}

export const skierScreenY = (state: GameState) => state.height * SKIER_Y_RATIO;

export function score(state: GameState): number {
  return Math.floor(state.distance * METERS_PER_PX) * SCORE.perMeter + state.bonus;
}

/** 0 at the start, 1 once the speed cap is reached. */
export function difficulty(state: GameState): number {
  return (state.speed - SPEED.start) / (SPEED.max - SPEED.start);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function acquire(state: GameState): Entity | null {
  for (const e of state.entities) if (!e.active) return e;
  return null;
}

function spawnRow(state: GameState, worldY: number, random: Random): void {
  const d = clamp(difficulty(state), 0, 1);
  const maxItems = Math.round(lerp(SPAWN.maxItemsPerRowStart, SPAWN.maxItemsPerRowEnd, d));
  const count = 1 + Math.floor(random() * maxItems);
  const minX = SKIER.edgeMargin;
  const maxX = state.width - SKIER.edgeMargin;
  // Positions placed in this row (at most maxItemsPerRowEnd), tracked without allocating.
  let placed0 = -Infinity;
  let placed1 = -Infinity;
  let placed2 = -Infinity;
  let placed3 = -Infinity;
  let placedCount = 0;

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < SPAWN.placementAttempts; attempt++) {
      const x = lerp(minX, maxX, random());
      const tooClose =
        Math.abs(x - placed0) < SPAWN.minSpacing ||
        Math.abs(x - placed1) < SPAWN.minSpacing ||
        Math.abs(x - placed2) < SPAWN.minSpacing ||
        Math.abs(x - placed3) < SPAWN.minSpacing;
      if (tooClose) continue;
      const entity = acquire(state);
      if (!entity) return;
      const collectible = random() < SPAWN.collectibleChance;
      entity.active = true;
      entity.x = x;
      entity.y = worldY + (random() - 0.5) * SPAWN.minSpacing * 0.5;
      entity.variant = Math.floor(random() * 2);
      entity.kind = collectible
        ? random() < SPAWN.khachapuriShare
          ? 'khachapuri'
          : 'snowflake'
        : OBSTACLE_KINDS[Math.floor(random() * OBSTACLE_KINDS.length)]!;
      if (placedCount === 0) placed0 = x;
      else if (placedCount === 1) placed1 = x;
      else if (placedCount === 2) placed2 = x;
      else placed3 = x;
      placedCount++;
      break;
    }
  }
}

function overlaps(state: GameState, e: Entity, skierWorldY: number): boolean {
  const box = ENTITY[e.kind].hitbox;
  const sx = state.skierX;
  const sy = skierWorldY + SKIER.hitbox.offsetY;
  const ex = e.x;
  const ey = e.y + box.offsetY;
  return (
    Math.abs(sx - ex) * 2 < SKIER.hitbox.width + box.width &&
    Math.abs(sy - ey) * 2 < SKIER.hitbox.height + box.height
  );
}

const isCollectible = (kind: EntityKind) => kind === 'khachapuri' || kind === 'snowflake';

export function startGame(state: GameState): void {
  if (state.status === 'over') resetGame(state);
  state.status = 'playing';
}

export function step(state: GameState, input: GameInput, dt: number, random: Random): void {
  state.crashedThisStep = false;
  state.collectedThisStep = null;
  if (state.status !== 'playing') return;

  state.time += dt;
  state.speed = Math.min(SPEED.max, state.speed + SPEED.rampPerSecond * dt);

  // Steering with acceleration and friction feels like carving rather than teleporting.
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (steer !== 0) state.skierVx += steer * SKIER.lateralAcceleration * dt;
  else state.skierVx -= state.skierVx * Math.min(1, SKIER.lateralFriction * dt);
  state.skierVx = clamp(state.skierVx, -SKIER.maxLateralSpeed, SKIER.maxLateralSpeed);
  state.skierX += state.skierVx * dt;
  const minX = SKIER.edgeMargin;
  const maxX = state.width - SKIER.edgeMargin;
  if (state.skierX < minX || state.skierX > maxX) {
    state.skierX = clamp(state.skierX, minX, maxX);
    state.skierVx = 0;
  }

  state.distance += state.speed * dt;
  const skierWorldY = state.distance + skierScreenY(state);

  // Ski tracks
  if (skierWorldY >= state.nextTrailAt) {
    const i = state.trailHead * 2;
    state.trail[i] = state.skierX;
    state.trail[i + 1] = skierWorldY;
    state.trailHead = (state.trailHead + 1) % (state.trail.length / 2);
    state.trailCount = Math.min(state.trailCount + 1, state.trail.length / 2);
    state.nextTrailAt = skierWorldY + TRAIL.sampleEvery;
  }

  // Spawn rows ahead of the view.
  const spawnHorizon = state.distance + state.height + SPAWN.belowView;
  while (state.nextRowAt < spawnHorizon) {
    spawnRow(state, state.nextRowAt, random);
    const gap = lerp(SPAWN.rowGapStart, SPAWN.rowGapMin, clamp(difficulty(state), 0, 1));
    state.nextRowAt += gap * (1 + (random() * 2 - 1) * SPAWN.rowGapJitter);
  }

  if (state.invulnerableFor > 0) state.invulnerableFor = Math.max(0, state.invulnerableFor - dt);

  for (const e of state.entities) {
    if (!e.active) continue;
    if (e.y - state.distance < -DESPAWN_ABOVE) {
      e.active = false;
      continue;
    }
    if (!overlaps(state, e, skierWorldY)) continue;
    if (isCollectible(e.kind)) {
      e.active = false;
      state.collectedThisStep = e.kind;
      if (e.kind === 'khachapuri') {
        state.bonus += SCORE.khachapuri;
        state.collectedKhachapuri++;
      } else {
        state.bonus += SCORE.snowflake;
        state.collectedSnowflakes++;
      }
    } else if (state.invulnerableFor === 0) {
      state.crashedThisStep = true;
      state.lives--;
      state.speed = Math.max(SPEED.start, state.speed * SPEED.crashFactor);
      state.invulnerableFor = INVULNERABLE_SECONDS;
      if (state.lives <= 0) {
        state.lives = 0;
        state.status = 'over';
        return;
      }
    }
  }
}
