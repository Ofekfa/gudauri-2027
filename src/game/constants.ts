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

/**
 * Every difficulty number in one place. The engine reads the profile from
 * its state, so a preset can be swapped per run.
 */
export interface DifficultyProfile {
  name: string;
  speed: {
    start: number;
    /** A quick early ramp up to `cruise`, then a slow one up to `max` (px/s per second). */
    cruise: number;
    max: number;
    earlyRamp: number;
    lateRamp: number;
    /** Multiplier applied to speed on a crash (it then ramps up again). */
    crashFactor: number;
  };
  density: {
    /** Vertical gap between rows at the start and once pressure is full. */
    rowGapStart: number;
    rowGapMin: number;
    maxItemsPerRowStart: number;
    maxItemsPerRowEnd: number;
    /** Share of items that are collectibles, at the start and at full pressure. */
    collectibleChance: number;
    collectibleChanceEnd: number;
    /** Pressure (density, items per row, the heart supply) goes 0 → 1 over this long. */
    fullAfterSeconds: number;
  };
  /**
   * Extra lives. A rate per second of play (row spacing ÷ speed), so it doesn't
   * depend on how fast you go; scaled by missing lives (none at the cap) and
   * fading with pressure, so runs still end.
   */
  hearts: { perSecond: number; lateFactor: number; minGapSeconds: number };
  powerUps: Record<PowerUpId, PowerUpBalance>;
  magnetRadius: number;
  invulnerableSeconds: number;
  lives: { start: number; max: number };
}

export interface PowerUpBalance {
  duration: number;
  spawn: { perSecond: number; minSeconds: number; cooldownSeconds: number };
}

/** Faster than v1.15.0 from the first seconds, with rarer hearts and magnets. The default. */
const FASTER: DifficultyProfile = {
  name: 'faster',
  speed: { start: 300, cruise: 520, max: 720, earlyRamp: 10, lateRamp: 1.2, crashFactor: 0.6 },
  density: {
    rowGapStart: 180,
    rowGapMin: 90,
    maxItemsPerRowStart: 1,
    maxItemsPerRowEnd: 4,
    collectibleChance: 0.22,
    collectibleChanceEnd: 0.16,
    fullAfterSeconds: 540,
  },
  hearts: { perSecond: 1 / 16, lateFactor: 0.15, minGapSeconds: 10 },
  powerUps: {
    magnet: { duration: 7, spawn: { perSecond: 1 / 45, minSeconds: 20, cooldownSeconds: 30 } },
    shield: { duration: 12, spawn: { perSecond: 1 / 70, minSeconds: 40, cooldownSeconds: 30 } },
    slowmo: { duration: 6, spawn: { perSecond: 1 / 80, minSeconds: 45, cooldownSeconds: 30 } },
    double: { duration: 10, spawn: { perSecond: 1 / 60, minSeconds: 25, cooldownSeconds: 30 } },
  },
  magnetRadius: 140,
  invulnerableSeconds: 1.6,
  lives: { start: 3, max: 5 },
};

/** Trial presets (temporary): pick one with `#/game?preset=<name>`. */
export const PRESETS = {
  /** A little gentler: slower top speed. */
  fast: {
    ...FASTER,
    name: 'fast',
    speed: { ...FASTER.speed, start: 280, cruise: 480, max: 680, earlyRamp: 9 },
    hearts: { ...FASTER.hearts, perSecond: 1 / 18 },
  },
  faster: FASTER,
  /** Quickest start and top speed. */
  fastest: {
    ...FASTER,
    name: 'fastest',
    speed: { ...FASTER.speed, start: 340, cruise: 600, max: 800, earlyRamp: 13 },
    hearts: { ...FASTER.hearts, perSecond: 1 / 18 },
  },
} satisfies Record<string, DifficultyProfile>;

export type PresetName = keyof typeof PRESETS;
export const DEFAULT_PROFILE: DifficultyProfile = PRESETS.faster;

/**
 * Fairness floor: an obstacle must stay on screen at least this long before
 * it reaches the skier, so short screens cap the speed (only below ~600 px).
 */
export const MIN_REACTION_SECONDS = 0.45;

/** 20 px of slope = 1 m (so 300 px/s ≈ 54 km/h). */
export const METERS_PER_PX = 0.05;
export const KMH_PER_MPS = 3.6;

export const SCORE = {
  perMeter: 1,
  khachapuri: 50,
  snowflake: 15,
  /** A heart caught with full lives (one already on the slope when you hit the cap). */
  heartAtCap: 50,
} as const;

export const SPAWN = {
  /** Random spread applied to each gap (±). */
  rowGapJitter: 0.3,
  /** Share of collectibles that are khachapuri (the rest are snowflakes). */
  khachapuriShare: 0.35,
  /** Minimum horizontal distance between items in one row. */
  minSpacing: 70,
  /** Spawn this far below the bottom edge so items scroll in smoothly. */
  belowView: 60,
  /** Tries to place an item before giving up for that row. */
  placementAttempts: 8,
} as const;

/** Hearts and power-ups keep this far from any obstacle (centre to centre). */
export const PICKUP_CLEARANCE = { x: 44, y: 90 } as const;

export type PowerUpId = 'magnet' | 'shield' | 'slowmo' | 'double';

export interface PowerUpTuning {
  /** The slope item that grants it (and its sprite). */
  kind: EntityKind;
  /** HUD icon and the pickup message ("🧲 Magnet!"). */
  icon: string;
  label: string;
  /** What it does, short, for the start-screen tip ("pulls items to you"). */
  hint: string;
  /** What it does, for How to play. */
  detail: string;
  /** The HUD timer warns (blinks) for the last this-many seconds. */
  warnSeconds: number;
  /** Applied to collectible points while active. */
  scoreMultiplier?: number;
  /** Multiplies how fast the slope moves (and so distance points) while active. */
  slopeSpeedFactor?: number;
  /** Takes the next crash instead of a life, then ends. */
  absorbsCrash?: boolean;
}

export const POWER_UPS: Record<PowerUpId, PowerUpTuning> = {
  magnet: {
    kind: 'magnet',
    icon: '🧲',
    label: 'Magnet',
    hint: 'pulls items to you',
    detail: 'pulls nearby khachapuri, snowflakes and hearts to you',
    warnSeconds: 2,
  },
  shield: {
    kind: 'shield',
    icon: '🛡️',
    label: 'Shield',
    hint: 'blocks one crash',
    detail: 'takes your next crash instead of a life (it lasts until then, or runs out)',
    warnSeconds: 2,
    absorbsCrash: true,
  },
  slowmo: {
    kind: 'slowmo',
    icon: '⏳',
    label: 'Slow-mo',
    hint: 'slows the slope down',
    detail: 'slows the whole slope down, so busy stretches are easier to thread',
    warnSeconds: 1.5,
    slopeSpeedFactor: 0.6,
  },
  double: {
    kind: 'double',
    icon: '2×',
    label: 'Double points',
    hint: 'double points',
    detail: 'makes khachapuri and snowflakes worth twice as much',
    warnSeconds: 2,
    scoreMultiplier: 2,
  },
};

/** After the shield takes a hit: a moment to get clear of that cluster. */
export const SHIELD_GRACE_SECONDS = 0.6;

/** How caught items fly in (the catch radius is in the profile). */
export const MAGNET = {
  /** Steering acceleration toward the skier. */
  acceleration: 2600,
  /** Top approach speed, relative to the skier. */
  maxSpeed: 700,
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

export type EntityKind =
  | 'tree'
  | 'rock'
  | 'flag'
  | 'khachapuri'
  | 'snowflake'
  | 'heart'
  | 'magnet'
  | 'shield'
  | 'slowmo'
  | 'double';
/** Obstacles crash you, collectibles score (and the magnet pulls them), power-ups activate. */
export type EntityRole = 'obstacle' | 'collectible' | 'powerup';
export const OBSTACLE_KINDS = ['tree', 'tree', 'rock', 'flag'] as const;

export const ENTITY: Record<
  EntityKind,
  {
    role: EntityRole;
    width: number;
    height: number;
    hitbox: { width: number; height: number; offsetY: number };
  }
> = {
  tree: { role: 'obstacle', width: 40, height: 54, hitbox: { width: 16, height: 14, offsetY: 18 } },
  rock: { role: 'obstacle', width: 34, height: 24, hitbox: { width: 26, height: 14, offsetY: 3 } },
  flag: { role: 'obstacle', width: 22, height: 40, hitbox: { width: 8, height: 12, offsetY: 14 } },
  khachapuri: {
    role: 'collectible',
    width: 34,
    height: 22,
    hitbox: { width: 30, height: 20, offsetY: 0 },
  },
  snowflake: {
    role: 'collectible',
    width: 24,
    height: 24,
    hitbox: { width: 22, height: 22, offsetY: 0 },
  },
  heart: {
    role: 'collectible',
    width: 26,
    height: 24,
    hitbox: { width: 24, height: 22, offsetY: 0 },
  },
  magnet: { role: 'powerup', width: 28, height: 28, hitbox: { width: 26, height: 26, offsetY: 0 } },
  shield: { role: 'powerup', width: 28, height: 30, hitbox: { width: 26, height: 26, offsetY: 0 } },
  slowmo: { role: 'powerup', width: 24, height: 30, hitbox: { width: 24, height: 26, offsetY: 0 } },
  double: { role: 'powerup', width: 30, height: 30, hitbox: { width: 26, height: 26, offsetY: 0 } },
};

export const HIGH_SCORES_PER_CHARACTER = 5;
