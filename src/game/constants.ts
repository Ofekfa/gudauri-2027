/** Every gameplay tuning number lives here. Units: CSS pixels and seconds. */

/** Skier's vertical position as a fraction of the view height (the world scrolls up past them). */
export const SKIER_Y_RATIO = 0.28;

export const SKIER = {
  /** Drawn size. */
  width: 44,
  height: 55,
  /** Forgiving hitbox around the skis/boots, relative to the skier's anchor point. */
  hitbox: { width: 20, height: 16, offsetY: 16 },
  maxLateralSpeed: 330,
  lateralAcceleration: 1700,
  /** Fraction of lateral speed lost per second with no steering input. */
  lateralFriction: 7,
  /** Keep the skier this far from the edges. */
  edgeMargin: 18,
  /** Visual tilt (radians) at full lateral speed. */
  maxTilt: 0.35,
} as const;

export const SPEED = {
  start: 240,
  max: 640,
  /** Increase per second of play. */
  rampPerSecond: 7,
  /** Multiplier applied to speed on a crash. */
  crashFactor: 0.55,
} as const;

export const LIVES = 3;
export const INVULNERABLE_SECONDS = 1.6;

/** 20 px of slope = 1 m, so the start speed is ~43 km/h and the cap ~115 km/h. */
export const METERS_PER_PX = 0.05;
export const KMH_PER_MPS = 3.6;

export const SCORE = {
  perMeter: 1,
  khachapuri: 50,
  snowflake: 15,
} as const;

export const SPAWN = {
  /** Vertical gap between rows at the start and at max difficulty. */
  rowGapStart: 150,
  rowGapMin: 75,
  /** Random spread applied to each gap (±). */
  rowGapJitter: 0.3,
  maxItemsPerRowStart: 2,
  maxItemsPerRowEnd: 4,
  collectibleChance: 0.22,
  /** Share of collectibles that are khachapuri (the rest are snowflakes). */
  khachapuriShare: 0.35,
  /** Minimum horizontal distance between items in one row. */
  minSpacing: 70,
  /** Spawn this far below the bottom edge so items scroll in smoothly. */
  belowView: 60,
  /** Tries to place an item before giving up for that row. */
  placementAttempts: 8,
} as const;

/** Item travels this far above the top before it's recycled. */
export const DESPAWN_ABOVE = 80;

export const POOL_SIZE = 96;

/** Fixed simulation step for deterministic, frame-rate-independent physics. */
export const FIXED_STEP = 1 / 120;
export const MAX_STEPS_PER_FRAME = 8;
/** Canvas resolution cap; higher DPRs cost fill-rate for little visible gain. */
export const MAX_DEVICE_PIXEL_RATIO = 2;
/** Max logical width of the play field. */
export const MAX_FIELD_WIDTH = 480;

export const TRAIL = {
  /** Points kept in the ski-track ring buffer. */
  length: 64,
  /** Sample a point every N px of travel. */
  sampleEvery: 10,
} as const;

export type EntityKind = 'tree' | 'rock' | 'flag' | 'khachapuri' | 'snowflake';
export const OBSTACLE_KINDS = ['tree', 'tree', 'rock', 'flag'] as const;

export const ENTITY: Record<
  EntityKind,
  { width: number; height: number; hitbox: { width: number; height: number; offsetY: number } }
> = {
  tree: { width: 40, height: 54, hitbox: { width: 16, height: 14, offsetY: 18 } },
  rock: { width: 34, height: 24, hitbox: { width: 26, height: 14, offsetY: 3 } },
  flag: { width: 22, height: 40, hitbox: { width: 8, height: 12, offsetY: 14 } },
  khachapuri: { width: 34, height: 22, hitbox: { width: 30, height: 20, offsetY: 0 } },
  snowflake: { width: 24, height: 24, hitbox: { width: 22, height: 22, offsetY: 0 } },
};

export const HIGH_SCORES_PER_CHARACTER = 5;
