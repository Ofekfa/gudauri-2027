/**
 * Power-up registry: presentation comes from `POWER_UPS` in constants,
 * duration and spawn rates from the difficulty profile, behaviour from here.
 * A new power-up is one `POWER_UPS` entry, its profile balance, one
 * behaviour below and a sprite for its `kind`.
 */
import {
  DEFAULT_PROFILE,
  ENTITY,
  POWER_UPS,
  SKIER,
  type DifficultyProfile,
  type PowerUpBalance,
  type PowerUpId,
  type PowerUpTuning,
} from './constants';
import type { GameState } from './engine';

export interface PowerUpDef extends PowerUpTuning, PowerUpBalance {
  id: string;
  /** Runs every step while active. */
  step?: (state: GameState, dt: number, skierWorldY: number) => void;
}

/** How fast the slope actually moves: the skier's speed, slowed by any active slow-mo. */
export function slopeSpeed(state: GameState): number {
  let factor = 1;
  for (let i = 0; i < state.powerUpDefs.length; i++)
    if (state.powerUpTime[i]! > 0) factor *= state.powerUpDefs[i]!.slopeSpeedFactor ?? 1;
  return state.speed * factor;
}

/** Collectibles within the radius are caught by the field; the engine flies them in. */
function attract(state: GameState, _dt: number, skierWorldY: number): void {
  const cx = state.skierX;
  const cy = skierWorldY + SKIER.hitbox.offsetY;
  const r2 = state.profile.magnetRadius * state.profile.magnetRadius;
  for (const e of state.entities) {
    if (!e.active || e.pulled || ENTITY[e.kind].role !== 'collectible') continue;
    const dx = cx - e.x;
    const dy = cy - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    e.pulled = true;
    // Keep any closing speed it already had (things ahead rush up the slope);
    // drop the part moving away, so the distance only ever shrinks.
    const d = Math.sqrt(d2) || 1;
    const slope = slopeSpeed(state);
    const closing = Math.max(0, -(state.skierVx * dx + slope * dy) / d);
    e.vx = state.skierVx + (dx / d) * closing;
    e.vy = slope + (dy / d) * closing;
  }
}

/** Per-step behaviour. Shield, slow-mo and double points work through their tuning flags. */
const BEHAVIOUR: Record<PowerUpId, Pick<PowerUpDef, 'step'>> = {
  magnet: { step: attract },
  shield: {},
  slowmo: {},
  double: {},
};

export const powerUpsFor = (profile: DifficultyProfile): readonly PowerUpDef[] =>
  (Object.keys(POWER_UPS) as PowerUpId[]).map((id) => ({
    id,
    ...POWER_UPS[id],
    ...profile.powerUps[id],
    ...BEHAVIOUR[id],
  }));

export const DEFAULT_POWER_UPS = powerUpsFor(DEFAULT_PROFILE);
