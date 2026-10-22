/**
 * Album moments: the predefined ones from src/data/album.ts plus our own,
 * merged into one story order. Shared by the site and the Worker.
 *
 * Order keys are base-36 strings compared as plain strings ("fractional
 * indexing"): there is always a key between any two, so adding or moving a
 * moment never renumbers the others and never runs out of precision.
 */
import { ALBUM_FRAMES, type AlbumFrame } from '../../data/album';
import type { CustomMoment } from './protocol';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0]!;
/** Width of the predefined keys ("01", "02", …); fits 35 predefined moments. */
const PREDEFINED_KEY_WIDTH = 2;
/** New moments go just before this one by default, so the flight home stays last. */
export const DEFAULT_BEFORE_ID = 'flight-home';

export type Moment = AlbumFrame & { orderKey: string };

export function predefinedOrderKey(index: number): string {
  return (index + 1).toString(DIGITS.length).padStart(PREDEFINED_KEY_WIDTH, ZERO);
}

/**
 * A key strictly between `a` and `b` (`b` null = no upper bound). Keys never
 * end in "0", so there is always room below the next one.
 */
export function keyBetween(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`Bad key range ${a} … ${b}`);
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + keyBetween(a.slice(n), b.slice(n));
  }
  const low = a ? DIGITS.indexOf(a[0]!) : 0;
  const high = b !== null ? DIGITS.indexOf(b[0]!) : DIGITS.length;
  if (high - low > 1) return DIGITS[Math.round((low + high) / 2)]!;
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[low]! + keyBetween(a.slice(1), null);
}

export const isOrderKey = (key: unknown): key is string =>
  typeof key === 'string' && /^[0-9a-z]{1,64}$/.test(key) && !key.endsWith(ZERO);

const byOrder = (a: Moment, b: Moment) =>
  a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : a.id < b.id ? -1 : 1;

const PREDEFINED: Moment[] = ALBUM_FRAMES.map((f, i) => ({
  ...f,
  orderKey: predefinedOrderKey(i),
}));

export const isPredefined = (id: string) => ALBUM_FRAMES.some((f) => f.id === id);

export function customToMoment(m: CustomMoment): Moment {
  return {
    id: m.id,
    title: m.title,
    emoji: m.emoji,
    prompt: m.prompt ?? '',
    orderKey: m.orderKey,
    custom: true,
  };
}

/** Every moment in story order (ties, from simultaneous adds, by id). */
export function mergeMoments(custom: readonly CustomMoment[]): Moment[] {
  return [...PREDEFINED, ...custom.map(customToMoment)].sort(byOrder);
}

/**
 * The key for placing a moment right after `afterId` (`movingId` is ignored
 * as a neighbour when moving). Null if `afterId` isn't a moment.
 */
export function keyAfter(
  merged: readonly Moment[],
  afterId: string,
  movingId?: string,
): string | null {
  const list = merged.filter((m) => m.id !== movingId);
  const i = list.findIndex((m) => m.id === afterId);
  if (i === -1) return null;
  const next = list[i + 1];
  // Equal keys (two adds at once) leave no room; go after both.
  if (next && next.orderKey === list[i]!.orderKey) return keyAfter(list, next.id);
  return keyBetween(list[i]!.orderKey, next?.orderKey ?? null);
}

/** "Place after" default for a new moment: the one just before the flight home. */
export function defaultAfter(merged: readonly Moment[]): string {
  const i = merged.findIndex((m) => m.id === DEFAULT_BEFORE_ID);
  return merged[Math.max(0, i - 1)]!.id;
}

/** A change made on this phone that the server hasn't confirmed yet. */
export type MomentOp =
  | { kind: 'create'; moment: CustomMoment }
  | { kind: 'edit'; id: string; changes: Partial<CustomMoment> }
  | { kind: 'delete'; id: string };

/** Ids of moments created here but not yet saved; they can't take photos yet. */
export const PENDING_MOMENT_PREFIX = 'tmp-';

/** The server's custom moments with this phone's unconfirmed changes on top. */
export function applyMomentOps(
  moments: readonly CustomMoment[],
  ops: readonly MomentOp[],
): CustomMoment[] {
  let list = [...moments];
  for (const op of ops) {
    if (op.kind === 'create') list = [...list.filter((m) => m.id !== op.moment.id), op.moment];
    else if (op.kind === 'edit')
      list = list.map((m) => {
        if (m.id !== op.id) return m;
        const next = { ...m, ...op.changes };
        if (op.changes.prompt === '') delete next.prompt;
        return next;
      });
    else list = list.filter((m) => m.id !== op.id);
  }
  return list;
}
