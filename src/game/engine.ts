/**
 * Pure game simulation: no DOM, no timers. Mutates state in place and never
 * allocates during `step`, so the render loop stays smooth on phones.
 */
import {
  DEFAULT_PROFILE,
  DESPAWN_ABOVE,
  ENTITY,
  MAGNET,
  METERS_PER_PX,
  MIN_REACTION_SECONDS,
  OBSTACLE_KINDS,
  PICKUP_CLEARANCE,
  POOL_SIZE,
  SCORE,
  SHIELD_GRACE_SECONDS,
  SKIER,
  SKIER_Y_RATIO,
  SPAWN,
  TRAIL,
  type DifficultyProfile,
  type EntityKind,
} from './constants';
import { powerUpsFor, slopeSpeed, type PowerUpDef } from './powerUps';

export { slopeSpeed } from './powerUps';

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
  /** Caught by the magnet: flies toward the skier with this world velocity. */
  pulled: boolean;
  vx: number;
  vy: number;
  /** Index into the power-up registry, for power-up items. */
  powerUp: number;
}

export type GameStatus = 'ready' | 'playing' | 'over';

export interface GameInput {
  left: boolean;
  right: boolean;
}

export interface GameState {
  width: number;
  height: number;
  profile: DifficultyProfile;
  /** Top speed on this screen: the profile's, or lower on short screens (reaction-time floor). */
  speedCap: number;
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
  collectedHearts: number;
  collectedPowerUps: number;
  /** Earliest play time for the next heart / power-up to spawn. */
  heartReadyAt: number;
  powerUpReadyAt: number;
  powerUpDefs: readonly PowerUpDef[];
  /** Seconds left per power-up (same order as `powerUpDefs`); 0 = inactive. */
  powerUpTime: Float64Array;
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
  /** A heart added a life this step (false when it scored at the cap instead). */
  lifeGainedThisStep: boolean;
  /** Index of the power-up picked up this step, or -1. */
  poweredUpThisStep: number;
  /** A crash-absorbing power-up (the shield) took a hit this step. */
  shieldBrokeThisStep: boolean;
}

export interface GameOptions {
  profile?: DifficultyProfile;
  /** Defaults to the profile's power-ups (tests can register their own). */
  powerUps?: readonly PowerUpDef[];
}

/** The fastest speed that still shows an obstacle MIN_REACTION_SECONDS before it arrives. */
export const reactionSpeedCap = (height: number) =>
  (height * (1 - SKIER_Y_RATIO)) / MIN_REACTION_SECONDS;

export function createGameState(
  width: number,
  height: number,
  { profile = DEFAULT_PROFILE, powerUps = powerUpsFor(profile) }: GameOptions = {},
): GameState {
  const entities: Entity[] = Array.from({ length: POOL_SIZE }, () => ({
    active: false,
    kind: 'tree',
    x: 0,
    y: 0,
    variant: 0,
    pulled: false,
    vx: 0,
    vy: 0,
    powerUp: -1,
  }));
  const state: GameState = {
    width,
    height,
    profile,
    speedCap: Math.min(profile.speed.max, reactionSpeedCap(height)),
    status: 'ready',
    time: 0,
    distance: 0,
    speed: profile.speed.start,
    skierX: width / 2,
    skierVx: 0,
    lives: profile.lives.start,
    invulnerableFor: 0,
    bonus: 0,
    collectedKhachapuri: 0,
    collectedSnowflakes: 0,
    collectedHearts: 0,
    collectedPowerUps: 0,
    heartReadyAt: 0,
    powerUpReadyAt: 0,
    powerUpDefs: powerUps,
    powerUpTime: new Float64Array(powerUps.length),
    nextRowAt: 0,
    entities,
    trail: new Float32Array(TRAIL.length * 2),
    trailHead: 0,
    trailCount: 0,
    nextTrailAt: 0,
    crashedThisStep: false,
    collectedThisStep: null,
    lifeGainedThisStep: false,
    poweredUpThisStep: -1,
    shieldBrokeThisStep: false,
  };
  resetGame(state);
  return state;
}

/** Back to the start line, reusing all allocations. */
export function resetGame(state: GameState): void {
  state.status = 'ready';
  state.time = 0;
  state.distance = 0;
  state.speed = startSpeed(state);
  state.skierX = state.width / 2;
  state.skierVx = 0;
  state.lives = state.profile.lives.start;
  state.invulnerableFor = 0;
  state.bonus = 0;
  state.collectedKhachapuri = 0;
  state.collectedSnowflakes = 0;
  state.collectedHearts = 0;
  state.collectedPowerUps = 0;
  state.heartReadyAt = 0;
  state.powerUpReadyAt = 0;
  state.powerUpTime.fill(0);
  // First row appears just below the view, leaving a clear run-in.
  state.nextRowAt = state.height + SPAWN.belowView;
  for (const e of state.entities) e.active = false;
  state.trailHead = 0;
  state.trailCount = 0;
  state.nextTrailAt = 0;
  state.crashedThisStep = false;
  state.collectedThisStep = null;
  state.lifeGainedThisStep = false;
  state.poweredUpThisStep = -1;
  state.shieldBrokeThisStep = false;
}

export function resizeGame(state: GameState, width: number, height: number): void {
  state.width = width;
  state.height = height;
  state.speedCap = Math.min(state.profile.speed.max, reactionSpeedCap(height));
  state.speed = Math.min(state.speed, state.speedCap);
  state.skierX = clamp(state.skierX, SKIER.edgeMargin, width - SKIER.edgeMargin);
}

export const skierScreenY = (state: GameState) => state.height * SKIER_Y_RATIO;

export function score(state: GameState): number {
  return Math.floor(state.distance * METERS_PER_PX) * SCORE.perMeter + state.bonus;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0 at the start, 1 after `density.fullAfterSeconds` of play: drives density and the heart supply. */
export function pressure(state: GameState): number {
  return clamp(state.time / state.profile.density.fullAfterSeconds, 0, 1);
}

const startSpeed = (state: GameState) => Math.min(state.profile.speed.start, state.speedCap);

/** Speed after `dt` more seconds: quick up to cruise, slow after, never past the cap. */
export function rampSpeed(speed: number, profile: DifficultyProfile, cap: number, dt: number) {
  const { cruise, earlyRamp, lateRamp } = profile.speed;
  return Math.min(cap, speed + (speed < cruise ? earlyRamp : lateRamp) * dt);
}

/** Chance that a row with this spacing (in seconds of travel) carries a heart. */
export function heartChance(
  profile: DifficultyProfile,
  lives: number,
  pressureLevel: number,
  rowSeconds: number,
): number {
  const { max } = profile.lives;
  const missing = clamp((max - lives) / (max - 1), 0, 1);
  const { perSecond, lateFactor } = profile.hearts;
  return perSecond * rowSeconds * missing * lerp(1, lateFactor, pressureLevel);
}

export const rowGap = (state: GameState) =>
  lerp(state.profile.density.rowGapStart, state.profile.density.rowGapMin, pressure(state));

/** Seconds left on a power-up (0 when inactive). */
export function powerUpLeft(state: GameState, id: string): number {
  for (let i = 0; i < state.powerUpDefs.length; i++)
    if (state.powerUpDefs[i]!.id === id) return state.powerUpTime[i]!;
  return 0;
}

/** Index of an active power-up that absorbs a crash (the shield), or -1. */
function activeShield(state: GameState): number {
  for (let i = 0; i < state.powerUpDefs.length; i++)
    if (state.powerUpTime[i]! > 0 && state.powerUpDefs[i]!.absorbsCrash) return i;
  return -1;
}

function pointsMultiplier(state: GameState): number {
  let m = 1;
  for (let i = 0; i < state.powerUpDefs.length; i++)
    if (state.powerUpTime[i]! > 0) m *= state.powerUpDefs[i]!.scoreMultiplier ?? 1;
  return m;
}

const needsClearance = (e: Entity) => e.kind === 'heart' || ENTITY[e.kind].role === 'powerup';

function acquire(state: GameState): Entity | null {
  for (const e of state.entities) if (!e.active) return e;
  return null;
}

/** No active entity of the other group (obstacles vs hearts/power-ups) near this spot. */
function clearSpot(state: GameState, x: number, y: number, pickup: boolean): boolean {
  for (const e of state.entities) {
    if (!e.active) continue;
    const other = pickup ? ENTITY[e.kind].role === 'obstacle' : needsClearance(e);
    if (other && Math.abs(e.x - x) < PICKUP_CLEARANCE.x && Math.abs(e.y - y) < PICKUP_CLEARANCE.y)
      return false;
  }
  return true;
}

function powerUpOnSlope(state: GameState): boolean {
  for (const e of state.entities) if (e.active && e.powerUp >= 0) return true;
  return false;
}

/** Picks the row's special item (a heart or a power-up), if any: kind, power-up index. */
function rollSpecial(state: GameState, random: Random): number {
  const rowSeconds = rowGap(state) / slopeSpeed(state);
  if (
    state.time >= state.heartReadyAt &&
    random() < heartChance(state.profile, state.lives, pressure(state), rowSeconds)
  )
    return SPECIAL_HEART;
  if (state.time < state.powerUpReadyAt || powerUpOnSlope(state)) return SPECIAL_NONE;
  // One roll for "any power-up", then pick which by rate, so registry order doesn't matter.
  let total = 0;
  for (const def of state.powerUpDefs)
    if (state.time >= def.spawn.minSeconds) total += def.spawn.perSecond;
  if (total === 0 || random() >= total * rowSeconds) return SPECIAL_NONE;
  let pick = random() * total;
  for (let i = 0; i < state.powerUpDefs.length; i++) {
    const spawn = state.powerUpDefs[i]!.spawn;
    if (state.time < spawn.minSeconds) continue;
    pick -= spawn.perSecond;
    if (pick < 0) return i;
  }
  return SPECIAL_NONE;
}

const SPECIAL_NONE = -1;
const SPECIAL_HEART = -2;

function place(entity: Entity, kind: EntityKind, x: number, y: number, variant: number) {
  entity.active = true;
  entity.kind = kind;
  entity.x = x;
  entity.y = y;
  entity.variant = variant;
  entity.pulled = false;
  entity.vx = 0;
  entity.vy = 0;
  entity.powerUp = -1;
}

function spawnRow(state: GameState, worldY: number, random: Random): void {
  const p = pressure(state);
  const d = state.profile.density;
  const maxItems = Math.round(lerp(d.maxItemsPerRowStart, d.maxItemsPerRowEnd, p));
  const collectibleChance = lerp(d.collectibleChance, d.collectibleChanceEnd, p);
  const count = 1 + Math.floor(random() * maxItems);
  let special = rollSpecial(state, random);
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
      const y = worldY + (random() - 0.5) * SPAWN.minSpacing * 0.5;
      const variant = Math.floor(random() * 2);
      // The first slot carries the row's heart or power-up, away from every obstacle.
      const isSpecial = i === 0 && special !== SPECIAL_NONE;
      let kind: EntityKind;
      if (isSpecial) {
        if (!clearSpot(state, x, y, true)) continue;
        kind = special === SPECIAL_HEART ? 'heart' : state.powerUpDefs[special]!.kind;
      } else if (random() < collectibleChance) {
        kind = random() < SPAWN.khachapuriShare ? 'khachapuri' : 'snowflake';
      } else {
        kind = OBSTACLE_KINDS[Math.floor(random() * OBSTACLE_KINDS.length)]!;
        if (!clearSpot(state, x, y, false)) continue;
      }
      const entity = acquire(state);
      if (!entity) return;
      place(entity, kind, x, y, variant);
      if (isSpecial) {
        if (special === SPECIAL_HEART)
          state.heartReadyAt = state.time + state.profile.hearts.minGapSeconds;
        else {
          entity.powerUp = special;
          state.powerUpReadyAt = state.time + state.powerUpDefs[special]!.spawn.cooldownSeconds;
        }
        special = SPECIAL_NONE;
      }
      if (placedCount === 0) placed0 = x;
      else if (placedCount === 1) placed1 = x;
      else if (placedCount === 2) placed2 = x;
      else placed3 = x;
      placedCount++;
      break;
    }
    // A special that found no clear spot is dropped rather than squeezed in.
    if (i === 0) special = SPECIAL_NONE;
  }
}

/** Magnet-caught collectibles steer toward the skier (velocity relative to the skier, capped). */
function movePulled(state: GameState, dt: number, skierWorldY: number): void {
  const cx = state.skierX;
  const cy = skierWorldY + SKIER.hitbox.offsetY;
  const maxDv = MAGNET.acceleration * dt;
  for (const e of state.entities) {
    if (!e.active || !e.pulled) continue;
    const dx = cx - e.x;
    const dy = cy - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    // Close enough to arrive this step: land on the skier (collected below).
    if (d <= MAGNET.maxSpeed * dt) {
      e.x = cx;
      e.y = cy;
      continue;
    }
    let ax = state.skierVx + (dx / d) * MAGNET.maxSpeed - e.vx;
    let ay = slopeSpeed(state) + (dy / d) * MAGNET.maxSpeed - e.vy;
    const a = Math.sqrt(ax * ax + ay * ay);
    if (a > maxDv) {
      ax *= maxDv / a;
      ay *= maxDv / a;
    }
    e.vx += ax;
    e.vy += ay;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
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

function collect(state: GameState, kind: EntityKind): void {
  const multiplier = pointsMultiplier(state);
  if (kind === 'khachapuri') {
    state.bonus += SCORE.khachapuri * multiplier;
    state.collectedKhachapuri++;
  } else if (kind === 'snowflake') {
    state.bonus += SCORE.snowflake * multiplier;
    state.collectedSnowflakes++;
  } else if (kind === 'heart') {
    state.collectedHearts++;
    if (state.lives < state.profile.lives.max) {
      state.lives++;
      state.lifeGainedThisStep = true;
    } else {
      state.bonus += SCORE.heartAtCap * multiplier;
    }
  }
}

export function startGame(state: GameState): void {
  if (state.status === 'over') resetGame(state);
  state.status = 'playing';
}

export function step(state: GameState, input: GameInput, dt: number, random: Random): void {
  state.crashedThisStep = false;
  state.collectedThisStep = null;
  state.lifeGainedThisStep = false;
  state.poweredUpThisStep = -1;
  state.shieldBrokeThisStep = false;
  if (state.status !== 'playing') return;

  state.time += dt;
  state.speed = rampSpeed(state.speed, state.profile, state.speedCap, dt);

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

  state.distance += slopeSpeed(state) * dt;
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
    state.nextRowAt += rowGap(state) * (1 + (random() * 2 - 1) * SPAWN.rowGapJitter);
  }

  if (state.invulnerableFor > 0) state.invulnerableFor = Math.max(0, state.invulnerableFor - dt);

  for (let i = 0; i < state.powerUpDefs.length; i++) {
    if (state.powerUpTime[i]! <= 0) continue;
    state.powerUpDefs[i]!.step?.(state, dt, skierWorldY);
    state.powerUpTime[i] = Math.max(0, state.powerUpTime[i]! - dt);
  }
  movePulled(state, dt, skierWorldY);

  for (const e of state.entities) {
    if (!e.active) continue;
    if (e.y - state.distance < -DESPAWN_ABOVE) {
      e.active = false;
      continue;
    }
    if (!overlaps(state, e, skierWorldY)) continue;
    const role = ENTITY[e.kind].role;
    if (role === 'collectible') {
      e.active = false;
      state.collectedThisStep = e.kind;
      collect(state, e.kind);
    } else if (role === 'powerup') {
      e.active = false;
      const def = state.powerUpDefs[e.powerUp];
      if (!def) continue;
      // Picking one up while it's active refreshes it to the full duration.
      state.powerUpTime[e.powerUp] = def.duration;
      state.poweredUpThisStep = e.powerUp;
      state.collectedPowerUps++;
    } else if (state.invulnerableFor === 0 && activeShield(state) >= 0) {
      // The shield takes the hit: no life lost, no slowdown, and the obstacle is gone.
      state.powerUpTime[activeShield(state)] = 0;
      e.active = false;
      state.invulnerableFor = SHIELD_GRACE_SECONDS;
      state.shieldBrokeThisStep = true;
    } else if (state.invulnerableFor === 0) {
      state.crashedThisStep = true;
      state.lives--;
      state.speed = Math.max(startSpeed(state), state.speed * state.profile.speed.crashFactor);
      state.invulnerableFor = state.profile.invulnerableSeconds;
      if (state.lives <= 0) {
        state.lives = 0;
        state.status = 'over';
        return;
      }
    }
  }
}
