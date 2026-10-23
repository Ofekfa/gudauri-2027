/**
 * Short-lived visual feedback (floating "+1 ❤️" text, the lives pulse). Lives
 * outside the engine: it runs on real frame time and never affects play.
 * Preallocated, so frames don't allocate.
 */

const FLOATER_POOL = 6;
export const FLOATER_SECONDS = 0.9;
export const LIVES_PULSE_SECONDS = 0.35;

export interface Floater {
  active: boolean;
  text: string;
  /** Screen position where it appeared. */
  x: number;
  y: number;
  age: number;
}

export interface Effects {
  floaters: Floater[];
  /** Seconds left on the HUD heart pulse, and which heart (0-based) it's on. */
  livesPulse: number;
  pulseIndex: number;
}

export function createEffects(): Effects {
  return {
    floaters: Array.from({ length: FLOATER_POOL }, () => ({
      active: false,
      text: '',
      x: 0,
      y: 0,
      age: 0,
    })),
    livesPulse: 0,
    pulseIndex: 0,
  };
}

export function addFloater(fx: Effects, text: string, x: number, y: number): void {
  // Reuse a free slot, or the oldest one.
  let slot = fx.floaters[0]!;
  for (const f of fx.floaters) {
    if (!f.active) {
      slot = f;
      break;
    }
    if (f.age > slot.age) slot = f;
  }
  slot.active = true;
  slot.text = text;
  slot.x = x;
  slot.y = y;
  slot.age = 0;
}

export function pulseLives(fx: Effects, index: number): void {
  fx.livesPulse = LIVES_PULSE_SECONDS;
  fx.pulseIndex = index;
}

export function tickEffects(fx: Effects, dt: number): void {
  fx.livesPulse = Math.max(0, fx.livesPulse - dt);
  for (const f of fx.floaters) {
    if (!f.active) continue;
    f.age += dt;
    if (f.age >= FLOATER_SECONDS) f.active = false;
  }
}

export function clearEffects(fx: Effects): void {
  fx.livesPulse = 0;
  for (const f of fx.floaters) f.active = false;
}
