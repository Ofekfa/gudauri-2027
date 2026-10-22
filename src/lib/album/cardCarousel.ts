/** Pure helpers for browsing a moment's photos right on its grid card. */
import { wrapIndex, type SwipeDirection } from '../facts/carousel';
import { href } from '../router/hashRouter';
import type { AlbumPhoto } from './protocol';

/** Up to this many photos the position is shown as dots, then as "2 / 7". */
export const MAX_DOTS = 5;

/** Cards open on the cover photo (or the first one). */
export function startIndex(photos: readonly AlbumPhoto[], coverId: string | undefined): number {
  return Math.max(
    0,
    photos.findIndex((p) => p.id === coverId),
  );
}

export const step = (index: number, dir: SwipeDirection, length: number) =>
  wrapIndex(index + (dir === 'next' ? 1 : -1), length);

export type Indicator =
  { kind: 'dots'; count: number; active: number } | { kind: 'counter'; text: string };

export function indicator(index: number, length: number): Indicator {
  return length <= MAX_DOTS
    ? { kind: 'dots', count: length, active: index }
    : { kind: 'counter', text: `${index + 1} / ${length}` };
}

/** The moment's page, opened at this photo. */
export const photoHref = (frameId: string, photoId: string) =>
  href(`/album/${encodeURIComponent(frameId)}/${encodeURIComponent(photoId)}`);
