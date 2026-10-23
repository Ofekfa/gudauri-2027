/**
 * Everything the game draws is pre-rendered once into small canvases at the
 * device pixel ratio, so each frame is just a handful of drawImage calls.
 */
import { h, render as renderVNode } from 'preact';
import { AvatarSkier } from '../avatars/Avatar';
import type { TravelerId } from '../data/trip';
import { ENTITY, SKIER, type EntityKind } from './constants';

export interface Sprite {
  image: HTMLCanvasElement;
  /** Logical (CSS px) size. */
  width: number;
  height: number;
}

const COLORS = {
  shadow: 'rgba(14, 42, 71, 0.16)',
  trunk: '#7a4b2a',
  pineDark: '#2f6b4f',
  pineLight: '#3f8a63',
  snow: '#ffffff',
  rock: '#8a96a3',
  rockDark: '#66727f',
  pole: '#4a5568',
  flagRed: '#e63946',
  flagBlue: '#1f6fd1',
  crust: '#d99a3d',
  crustDark: '#b97a24',
  cheese: '#ffe08a',
  yolk: '#ffb703',
  flake: '#3d8bfd',
  heart: '#e63946',
  heartDark: '#b3202c',
  magnet: '#d62839',
  magnetDark: '#9e1b29',
  steel: '#c9d3de',
  steelDark: '#8794a3',
} as const;

function makeSprite(
  width: number,
  height: number,
  dpr: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Sprite {
  const image = document.createElement('canvas');
  image.width = Math.ceil(width * dpr);
  image.height = Math.ceil(height * dpr);
  const ctx = image.getContext('2d')!;
  ctx.scale(dpr, dpr);
  draw(ctx);
  return { image, width, height };
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, w: number, h: number) {
  shadow(ctx, w / 2, h - 3, w * 0.38, 4);
  ctx.fillStyle = COLORS.trunk;
  ctx.fillRect(w / 2 - 3, h - 12, 6, 9);
  const tiers = [
    { top: 2, bottom: h * 0.42, half: w * 0.26 },
    { top: h * 0.2, bottom: h * 0.64, half: w * 0.36 },
    { top: h * 0.38, bottom: h * 0.82, half: w * 0.46 },
  ];
  for (const t of tiers) {
    ctx.fillStyle = COLORS.pineDark;
    ctx.beginPath();
    ctx.moveTo(w / 2, t.top);
    ctx.lineTo(w / 2 - t.half, t.bottom);
    ctx.lineTo(w / 2 + t.half, t.bottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.pineLight;
    ctx.beginPath();
    ctx.moveTo(w / 2, t.top);
    ctx.lineTo(w / 2 + t.half, t.bottom);
    ctx.lineTo(w / 2, t.bottom);
    ctx.closePath();
    ctx.fill();
    // Snow on the branch tips
    ctx.fillStyle = COLORS.snow;
    ctx.beginPath();
    ctx.ellipse(w / 2 - t.half * 0.55, t.bottom - 2, t.half * 0.35, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(w / 2 + t.half * 0.5, t.bottom - 2, t.half * 0.3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.snow;
  ctx.beginPath();
  ctx.moveTo(w / 2, 1);
  ctx.lineTo(w / 2 - 5, 9);
  ctx.lineTo(w / 2 + 5, 9);
  ctx.closePath();
  ctx.fill();
}

function drawRock(ctx: CanvasRenderingContext2D, w: number, h: number) {
  shadow(ctx, w / 2, h - 3, w * 0.48, 4);
  ctx.fillStyle = COLORS.rockDark;
  ctx.beginPath();
  ctx.moveTo(2, h - 4);
  ctx.lineTo(6, h * 0.35);
  ctx.lineTo(w * 0.42, 2);
  ctx.lineTo(w * 0.78, h * 0.25);
  ctx.lineTo(w - 2, h - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.rock;
  ctx.beginPath();
  ctx.moveTo(4, h - 5);
  ctx.lineTo(7, h * 0.38);
  ctx.lineTo(w * 0.42, 4);
  ctx.lineTo(w * 0.6, h - 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.snow;
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.22);
  ctx.lineTo(w * 0.42, 2);
  ctx.lineTo(w * 0.7, h * 0.2);
  ctx.quadraticCurveTo(w * 0.45, h * 0.32, w * 0.22, h * 0.22);
  ctx.fill();
}

function drawFlag(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  shadow(ctx, 6, h - 3, 6, 2.5);
  ctx.strokeStyle = COLORS.pole;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, h - 3);
  ctx.lineTo(6, 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(7, 3);
  ctx.lineTo(w - 1, 9);
  ctx.lineTo(7, 16);
  ctx.closePath();
  ctx.fill();
}

function drawKhachapuri(ctx: CanvasRenderingContext2D, w: number, h: number) {
  shadow(ctx, w / 2, h - 2, w * 0.42, 3);
  // Boat-shaped crust with pointed ends
  ctx.fillStyle = COLORS.crustDark;
  ctx.beginPath();
  ctx.moveTo(1, h / 2);
  ctx.quadraticCurveTo(w / 2, -h * 0.25, w - 1, h / 2);
  ctx.quadraticCurveTo(w / 2, h * 1.15, 1, h / 2);
  ctx.fill();
  ctx.fillStyle = COLORS.crust;
  ctx.beginPath();
  ctx.moveTo(3, h / 2 - 1);
  ctx.quadraticCurveTo(w / 2, -h * 0.15, w - 3, h / 2 - 1);
  ctx.quadraticCurveTo(w / 2, h * 1.0, 3, h / 2 - 1);
  ctx.fill();
  ctx.fillStyle = COLORS.cheese;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.3, h * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.yolk;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.snow;
  ctx.beginPath();
  ctx.arc(w / 2 - 1.5, h / 2 - 1.5, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnowflake(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.42;
  ctx.lineCap = 'round';
  for (const [color, width] of [
    [COLORS.snow, 5],
    [COLORS.flake, 2.2],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      // Little branches
      const bx = cx + Math.cos(a) * r * 0.6;
      const by = cy + Math.sin(a) * r * 0.6;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + 0.8) * r * 0.25, by + Math.sin(a + 0.8) * r * 0.25);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a - 0.8) * r * 0.25, by + Math.sin(a - 0.8) * r * 0.25);
    }
    ctx.stroke();
  }
}

function heartPath(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(cx, top + h * 0.28);
  ctx.bezierCurveTo(cx, top, cx - w / 2, top, cx - w / 2, top + h * 0.32);
  ctx.bezierCurveTo(cx - w / 2, top + h * 0.6, cx - w * 0.12, top + h * 0.78, cx, top + h);
  ctx.bezierCurveTo(
    cx + w * 0.12,
    top + h * 0.78,
    cx + w / 2,
    top + h * 0.6,
    cx + w / 2,
    top + h * 0.32,
  );
  ctx.bezierCurveTo(cx + w / 2, top, cx, top, cx, top + h * 0.28);
  ctx.closePath();
}

function drawHeart(ctx: CanvasRenderingContext2D, w: number, h: number) {
  shadow(ctx, w / 2, h - 2, w * 0.3, 2.5);
  // A white rim keeps it readable against snow and trees alike.
  ctx.fillStyle = COLORS.snow;
  heartPath(ctx, w / 2, 0.5, w - 1, h - 3);
  ctx.fill();
  ctx.fillStyle = COLORS.heartDark;
  heartPath(ctx, w / 2, 2, w - 5, h - 6.5);
  ctx.fill();
  ctx.fillStyle = COLORS.heart;
  heartPath(ctx, w / 2, 2.5, w - 8, h - 9);
  ctx.fill();
  ctx.fillStyle = COLORS.snow;
  ctx.beginPath();
  ctx.ellipse(w * 0.33, h * 0.3, 2.6, 1.8, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawMagnet(ctx: CanvasRenderingContext2D, w: number, h: number) {
  shadow(ctx, w / 2, h - 2, w * 0.32, 2.5);
  const cx = w / 2;
  const cy = h * 0.42;
  const r = w * 0.3;
  const arm = h * 0.36;
  const thick = w * 0.2;
  // Horseshoe: white outline, dark edge, red body, steel tips.
  ctx.lineCap = 'butt';
  for (const [color, width] of [
    [COLORS.snow, thick + 4],
    [COLORS.magnetDark, thick + 1.5],
    [COLORS.magnet, thick - 1],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + arm);
    ctx.lineTo(cx - r, cy);
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineTo(cx + r, cy + arm);
    ctx.stroke();
  }
  const tip = arm * 0.42;
  for (const x of [cx - r, cx + r]) {
    ctx.fillStyle = COLORS.steelDark;
    ctx.fillRect(x - thick / 2 - 0.75, cy + arm - tip, thick + 1.5, tip + 0.5);
    ctx.fillStyle = COLORS.steel;
    ctx.fillRect(x - thick / 2 + 0.5, cy + arm - tip + 0.5, thick - 1, tip - 1);
  }
  ctx.fillStyle = COLORS.snow;
  ctx.beginPath();
  ctx.arc(cx - r * 0.55, cy - r * 0.7, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Obstacles, collectibles and power-ups; `variant` picks e.g. the flag colour. */
export type EntitySprites = Record<EntityKind, Sprite[]>;

export function createEntitySprites(dpr: number): EntitySprites {
  const size = (kind: EntityKind) => [ENTITY[kind].width, ENTITY[kind].height] as const;
  return {
    tree: [makeSprite(...size('tree'), dpr, (c) => drawTree(c, ...size('tree')))],
    rock: [makeSprite(...size('rock'), dpr, (c) => drawRock(c, ...size('rock')))],
    flag: [
      makeSprite(...size('flag'), dpr, (c) => drawFlag(c, ...size('flag'), COLORS.flagRed)),
      makeSprite(...size('flag'), dpr, (c) => drawFlag(c, ...size('flag'), COLORS.flagBlue)),
    ],
    khachapuri: [
      makeSprite(...size('khachapuri'), dpr, (c) => drawKhachapuri(c, ...size('khachapuri'))),
    ],
    snowflake: [
      makeSprite(...size('snowflake'), dpr, (c) => drawSnowflake(c, ...size('snowflake'))),
    ],
    heart: [makeSprite(...size('heart'), dpr, (c) => drawHeart(c, ...size('heart')))],
    magnet: [makeSprite(...size('magnet'), dpr, (c) => drawMagnet(c, ...size('magnet')))],
  };
}

/** Rasterizes the character's SVG skiing pose (the same art used across the site). */
export async function createSkierSprite(id: TravelerId, dpr: number): Promise<Sprite> {
  const host = document.createElement('div');
  renderVNode(h(AvatarSkier, { id, size: SKIER.width, decorative: true }), host);
  const svg = host.querySelector('svg');
  if (!svg) throw new Error('Avatar failed to render');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = new XMLSerializer().serializeToString(svg);
  renderVNode(null, host);

  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();
  return makeSprite(SKIER.width, SKIER.height, dpr, (ctx) =>
    ctx.drawImage(img, 0, 0, SKIER.width, SKIER.height),
  );
}
