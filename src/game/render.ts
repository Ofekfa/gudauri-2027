import { ENTITY, KMH_PER_MPS, METERS_PER_PX, SKIER, TRAIL } from './constants';
import { FLOATER_SECONDS, LIVES_PULSE_SECONDS, type Effects } from './effects';
import { score, skierScreenY, type GameState } from './engine';
import type { EntitySprites, Sprite } from './sprites';

const SNOW = '#f7fbff';
const TRACK = 'rgba(110, 145, 190, 0.35)';
const HUD_INK = '#0e2a47';
const HUD_HALO = 'rgba(255, 255, 255, 0.9)';
const HEART = '#e63946';
const HEART_EMPTY = 'rgba(14, 42, 71, 0.18)';
const TRACK_HALF_GAP = 5;
const HUD_PADDING = 12;
const HUD_FONT = '700 20px Fredoka, system-ui, sans-serif';
const HUD_SMALL_FONT = '600 13px system-ui, sans-serif';
/** Blink rate while invulnerable after a crash. */
const BLINK_PERIOD_S = 0.12;
/** Reduced motion: a steady see-through skier instead of blinking. */
const INVULNERABLE_ALPHA = 0.45;
const HEART_SPACING = 22;
/** Room for the DOM pause button at the top right. */
const PAUSE_BUTTON_ROOM = 48;
const LIVES_PULSE_SCALE = 0.4;
const MAGNET_RING = 'rgba(214, 40, 57, 0.28)';
const MAGNET_GLOW = 'rgba(214, 40, 57, 0.07)';
/** The ring breathes this much (fraction of its radius) and this fast. */
const RING_BREATH = 0.04;
const RING_BREATH_HZ = 1.5;
const TIMER_WIDTH = 64;
const TIMER_HEIGHT = 6;
const TIMER_TRACK = 'rgba(14, 42, 71, 0.18)';
const TIMER_FILL = '#d62839';
const TIMER_WARN = '#f4a261';
const WARN_BLINK_PERIOD_S = 0.2;
const FLOATER_RISE = 42;
const FLOATER_FONT = '700 18px Fredoka, system-ui, sans-serif';

export interface RenderOptions {
  sprites: EntitySprites;
  skier: Sprite;
  maxLives: number;
  presetLabel: string | null;
  effects: Effects;
  reducedMotion: boolean;
}

function drawEntities(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  sprites: EntitySprites,
  fromWorldY: number,
  toWorldY: number,
) {
  for (const e of state.entities) {
    if (!e.active || e.y < fromWorldY || e.y >= toWorldY) continue;
    const variants = sprites[e.kind];
    const sprite = variants[e.variant % variants.length]!;
    const { width, height } = ENTITY[e.kind];
    // Anchor: horizontal center, vertical center of the sprite.
    ctx.drawImage(sprite.image, e.x - width / 2, e.y - state.distance - height / 2, width, height);
  }
}

function drawTrail(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.trailCount < 2) return;
  const capacity = TRAIL.length;
  ctx.strokeStyle = TRACK;
  ctx.lineWidth = 2;
  for (const side of [-TRACK_HALF_GAP, TRACK_HALF_GAP]) {
    ctx.beginPath();
    for (let n = 0; n < state.trailCount; n++) {
      // Oldest to newest
      const idx = (state.trailHead - state.trailCount + n + capacity) % capacity;
      const x = state.trail[idx * 2]! + side;
      const y = state.trail[idx * 2 + 1]! - state.distance + SKIER.hitbox.offsetY + 8;
      if (n === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawSkier(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  skier: Sprite,
  reducedMotion: boolean,
) {
  const invulnerable = state.invulnerableFor > 0;
  if (
    invulnerable &&
    !reducedMotion &&
    Math.floor(state.invulnerableFor / BLINK_PERIOD_S) % 2 === 0
  ) {
    return;
  }
  // Lean into the turn.
  const tilt = -(state.skierVx / SKIER.maxLateralSpeed) * SKIER.maxTilt;
  ctx.save();
  if (invulnerable && reducedMotion) ctx.globalAlpha = INVULNERABLE_ALPHA;
  ctx.translate(state.skierX, skierScreenY(state));
  ctx.rotate(tilt);
  ctx.drawImage(skier.image, -SKIER.width / 2, -SKIER.height / 2, SKIER.width, SKIER.height);
  ctx.restore();
}

/** A soft field around the skier while the magnet is on. */
function drawMagnetField(ctx: CanvasRenderingContext2D, state: GameState, reducedMotion: boolean) {
  if (!magnetActive(state)) return;
  const breath = reducedMotion ? 0 : Math.sin(state.time * Math.PI * 2 * RING_BREATH_HZ);
  const r = state.profile.magnetRadius * (1 + RING_BREATH * breath);
  const cy = skierScreenY(state) + SKIER.hitbox.offsetY;
  ctx.beginPath();
  ctx.arc(state.skierX, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = MAGNET_GLOW;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = MAGNET_RING;
  ctx.stroke();
}

function magnetActive(state: GameState): boolean {
  for (let i = 0; i < state.powerUpDefs.length; i++)
    if (state.powerUpDefs[i]!.kind === 'magnet' && state.powerUpTime[i]! > 0) return true;
  return false;
}

function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.lineWidth = 4;
  ctx.strokeStyle = HUD_HALO;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = HUD_INK;
  ctx.fillText(text, x, y);
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, opts: RenderOptions) {
  const { maxLives, effects, reducedMotion } = opts;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.textAlign = 'left';
  ctx.font = HUD_FONT;
  haloText(ctx, `${score(state)}`, HUD_PADDING, HUD_PADDING);
  ctx.font = HUD_SMALL_FONT;
  const kmh = Math.round(state.speed * METERS_PER_PX * KMH_PER_MPS);
  haloText(ctx, `${kmh} km/h`, HUD_PADDING, HUD_PADDING + 24);
  if (opts.presetLabel) haloText(ctx, `Preset: ${opts.presetLabel}`, HUD_PADDING, HUD_PADDING + 42);

  // Lives as hearts, top-right (left of the DOM pause button).
  ctx.font = HUD_FONT;
  ctx.textAlign = 'right';
  const heartsRight = state.width - HUD_PADDING - PAUSE_BUTTON_ROOM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < maxLives; i++) {
    ctx.fillStyle = i < state.lives ? HEART : HEART_EMPTY;
    const x = heartsRight - i * HEART_SPACING - HEART_SPACING / 2;
    const y = HUD_PADDING + HEART_SPACING / 2;
    // The heart that just changed pops briefly.
    const pulse =
      effects.livesPulse > 0 && i === effects.pulseIndex && !reducedMotion
        ? 1 + LIVES_PULSE_SCALE * (effects.livesPulse / LIVES_PULSE_SECONDS)
        : 1;
    if (pulse === 1) {
      ctx.fillText('♥', x, y);
      continue;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.fillText('♥', 0, 0);
    ctx.restore();
  }
  ctx.textBaseline = 'top';

  // Active power-ups under the hearts: icon + a draining bar that warns near the end.
  let row = HUD_PADDING + 30;
  for (let i = 0; i < state.powerUpDefs.length; i++) {
    const left = state.powerUpTime[i]!;
    if (left <= 0) continue;
    const def = state.powerUpDefs[i]!;
    const warning = left <= def.warnSeconds;
    const hidden = warning && !reducedMotion && Math.floor(left / WARN_BLINK_PERIOD_S) % 2 === 0;
    const barX = heartsRight - TIMER_WIDTH;
    ctx.font = HUD_SMALL_FONT;
    ctx.textAlign = 'right';
    ctx.fillStyle = HUD_INK;
    ctx.fillText(def.icon, barX - 6, row - 3);
    ctx.fillStyle = TIMER_TRACK;
    ctx.fillRect(barX, row, TIMER_WIDTH, TIMER_HEIGHT);
    if (!hidden) {
      ctx.fillStyle = warning ? TIMER_WARN : TIMER_FILL;
      ctx.fillRect(barX, row, TIMER_WIDTH * (left / def.duration), TIMER_HEIGHT);
    }
    row += TIMER_HEIGHT + 14;
  }
}

function drawFloaters(ctx: CanvasRenderingContext2D, effects: Effects, reducedMotion: boolean) {
  ctx.font = FLOATER_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of effects.floaters) {
    if (!f.active) continue;
    const t = f.age / FLOATER_SECONDS;
    ctx.globalAlpha = 1 - t * t;
    haloText(ctx, f.text, f.x, f.y - (reducedMotion ? 0 : FLOATER_RISE * t));
  }
  ctx.globalAlpha = 1;
}

export function renderFrame(ctx: CanvasRenderingContext2D, state: GameState, opts: RenderOptions) {
  ctx.fillStyle = SNOW;
  ctx.fillRect(0, 0, state.width, state.height);
  drawTrail(ctx, state);
  drawMagnetField(ctx, state, opts.reducedMotion);
  // Things uphill of the skier are drawn behind them, downhill ones in front.
  const skierWorldY = state.distance + skierScreenY(state);
  drawEntities(ctx, state, opts.sprites, -Infinity, skierWorldY);
  drawSkier(ctx, state, opts.skier, opts.reducedMotion);
  drawEntities(ctx, state, opts.sprites, skierWorldY, Infinity);
  drawFloaters(ctx, opts.effects, opts.reducedMotion);
  drawHud(ctx, state, opts);
}
