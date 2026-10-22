import { ALBUM_FRAMES, PLANNED_FRAMES, type AlbumFrame } from '../../data/album';
import { trip } from '../../data/trip';
import { localDateIn } from '../time/countdown';
import type { AlbumFrameState, AlbumPhoto } from './protocol';
import type { QueueState } from './queue';

/** Photos per frame, oldest first (ties by id), for every frame. */
export function photosByFrame(photos: readonly AlbumPhoto[]): Map<string, AlbumPhoto[]> {
  const map = new Map(ALBUM_FRAMES.map((f) => [f.id, [] as AlbumPhoto[]]));
  for (const p of photos) map.get(p.frameId)?.push(p);
  for (const list of map.values()) {
    list.sort((a, b) =>
      a.uploadedAt < b.uploadedAt ? -1 : a.uploadedAt > b.uploadedAt ? 1 : a.id < b.id ? -1 : 1,
    );
  }
  return map;
}

/** The chosen cover if it still exists, else the first photo. */
export function coverFor(
  photos: readonly AlbumPhoto[],
  state: AlbumFrameState | undefined,
): AlbumPhoto | undefined {
  return photos.find((p) => p.id === state?.coverPhotoId) ?? photos[0];
}

export function albumProgress(byFrame: Map<string, AlbumPhoto[]>): {
  captured: number;
  total: number;
  bonus: number;
} {
  const has = (id: string) => (byFrame.get(id)?.length ?? 0) > 0;
  return {
    captured: PLANNED_FRAMES.filter((f) => has(f.id)).length,
    total: PLANNED_FRAMES.length,
    bonus: ALBUM_FRAMES.filter((f) => f.bonus && has(f.id)).length,
  };
}

/** From this hour (Tbilisi) on a trip day, Quick add suggests that evening's dinner. */
export const DINNER_FROM_HOUR = 17;
const FALLBACK_FRAME = 'the-four-of-us';

/** The frame Quick add offers first. */
export function suggestFrame(nowMs: number, byFrame: Map<string, AlbumPhoto[]>): string {
  const tz = trip.destinationTimeZone;
  const today = localDateIn(nowMs, tz);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(
      nowMs,
    ),
  );
  const dinner = `dinner-${today}`;
  if (hour >= DINNER_FROM_HOUR && ALBUM_FRAMES.some((f) => f.id === dinner)) return dinner;
  const empty = PLANNED_FRAMES.find(
    (f) => !f.id.startsWith('dinner-') && (byFrame.get(f.id)?.length ?? 0) === 0,
  );
  return empty?.id ?? FALLBACK_FRAME;
}

/** Index of a photo in a frame's list (unknown or missing → first). */
export const viewerIndex = (photos: readonly AlbumPhoto[], photoId: string | undefined) =>
  Math.max(
    0,
    photos.findIndex((p) => p.id === photoId),
  );

export type StorySlide =
  | { kind: 'title'; frame: AlbumFrame; count: number }
  | { kind: 'photo'; frame: AlbumFrame; photo: AlbumPhoto };

/** Story order: a title card for each moment with photos, then its photos. */
export function storySlides(photos: readonly AlbumPhoto[]): StorySlide[] {
  const byFrame = photosByFrame(photos);
  return ALBUM_FRAMES.flatMap((frame): StorySlide[] => {
    const list = byFrame.get(frame.id) ?? [];
    if (list.length === 0) return [];
    return [
      { kind: 'title', frame, count: list.length },
      ...list.map((photo) => ({ kind: 'photo' as const, frame, photo })),
    ];
  });
}

/** What a frame card says about its photos still on this phone, if any. */
export function pendingLabel(states: readonly QueueState[]): string | null {
  const failed = states.filter((s) => s === 'failed').length;
  const waiting = states.filter((s) => s === 'waiting-offline').length;
  const active = states.length - failed - waiting;
  const parts = [
    active && `Uploading ${active}…`,
    waiting && `${waiting} waiting for signal`,
    failed && `${failed} couldn’t be added`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
