import { ENTITY, KMH_PER_MPS, METERS_PER_PX, SKIER, TRAIL } from './constants';
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

export interface RenderOptions {
  sprites: EntitySprites;
  skier: Sprite;
  maxLives: number;
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

function drawSkier(ctx: CanvasRenderingContext2D, state: GameState, skier: Sprite) {
  if (state.invulnerableFor > 0 && Math.floor(state.invulnerableFor / BLINK_PERIOD_S) % 2 === 0) {
    return;
  }
  // Lean into the turn.
  const tilt = -(state.skierVx / SKIER.maxLateralSpeed) * SKIER.maxTilt;
  ctx.save();
  ctx.translate(state.skierX, skierScreenY(state));
  ctx.rotate(tilt);
  ctx.drawImage(skier.image, -SKIER.width / 2, -SKIER.height / 2, SKIER.width, SKIER.height);
  ctx.restore();
}

function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.lineWidth = 4;
  ctx.strokeStyle = HUD_HALO;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = HUD_INK;
  ctx.fillText(text, x, y);
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState, maxLives: number) {
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.textAlign = 'left';
  ctx.font = HUD_FONT;
  haloText(ctx, `${score(state)}`, HUD_PADDING, HUD_PADDING);
  ctx.font = HUD_SMALL_FONT;
  const kmh = Math.round(state.speed * METERS_PER_PX * KMH_PER_MPS);
  haloText(ctx, `${kmh} km/h`, HUD_PADDING, HUD_PADDING + 24);

  // Lives as hearts, top-right (left of the DOM pause button).
  ctx.font = HUD_FONT;
  ctx.textAlign = 'right';
  const heartsRight = state.width - HUD_PADDING - 48;
  for (let i = 0; i < maxLives; i++) {
    ctx.fillStyle = i < state.lives ? HEART : HEART_EMPTY;
    ctx.fillText('♥', heartsRight - i * 22, HUD_PADDING);
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, state: GameState, opts: RenderOptions) {
  ctx.fillStyle = SNOW;
  ctx.fillRect(0, 0, state.width, state.height);
  drawTrail(ctx, state);
  // Things uphill of the skier are drawn behind them, downhill ones in front.
  const skierWorldY = state.distance + skierScreenY(state);
  drawEntities(ctx, state, opts.sprites, -Infinity, skierWorldY);
  drawSkier(ctx, state, opts.skier);
  drawEntities(ctx, state, opts.sprites, skierWorldY, Infinity);
  drawHud(ctx, state, opts.maxLives);
}
