/**
 * The album's wire format and limits, shared by the site and the Worker.
 * Everything from the network is validated again on the other side.
 */
import { findFrame, MAX_CAPTION_CHARS } from '../../data/album';
import { trip, type TravelerId } from '../../data/trip';

export const MAX_FULL_BYTES = 1_600_000;
export const MAX_THUMB_BYTES = 150_000;
/** Whole multipart body, with room for the form encoding. */
export const MAX_UPLOAD_BYTES = MAX_FULL_BYTES + MAX_THUMB_BYTES + 20_000;
export const MAX_IMAGE_EDGE = 4096;
export const PHOTO_ID = /^[A-Za-z0-9-]{8,64}$/;
export type ImageSize = 'thumb' | 'full';

export interface AlbumPhoto {
  id: string;
  frameId: string;
  uploadedBy: TravelerId;
  /** ISO 8601. */
  uploadedAt: string;
  caption?: string;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
  /** Bumped on caption edits (ETag). */
  version: number;
}

export interface AlbumFrameState {
  coverPhotoId?: string;
  /** Bumped on cover changes (ETag); 0 before the first one. */
  version: number;
}

export interface AlbumListing {
  frames: Record<string, AlbumFrameState>;
  photos: AlbumPhoto[];
}

/** What the phone sends with an upload (the server adds `frameId` and `version`). */
export type UploadMeta = Omit<AlbumPhoto, 'frameId' | 'version' | 'caption'>;

const TRAVELERS = trip.travelers.map((t) => t.id);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isDim = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) > 0 && (v as number) <= MAX_IMAGE_EDGE;

/** Trimmed, single-line, control characters removed, length-capped. Empty → undefined. */
export function cleanCaption(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CAPTION_CHARS);
  return text || undefined;
}

export function parseUploadMeta(raw: unknown): UploadMeta | null {
  if (!isRecord(raw)) return null;
  const { id, uploadedBy, uploadedAt, width, height, thumbWidth, thumbHeight } = raw;
  if (typeof id !== 'string' || !PHOTO_ID.test(id)) return null;
  if (!TRAVELERS.includes(uploadedBy as TravelerId)) return null;
  if (typeof uploadedAt !== 'string' || Number.isNaN(Date.parse(uploadedAt))) return null;
  if (![width, height, thumbWidth, thumbHeight].every(isDim)) return null;
  return {
    id,
    uploadedBy: uploadedBy as TravelerId,
    uploadedAt: new Date(Date.parse(uploadedAt)).toISOString(),
    width: width as number,
    height: height as number,
    thumbWidth: thumbWidth as number,
    thumbHeight: thumbHeight as number,
  };
}

function parsePhoto(raw: unknown): AlbumPhoto | null {
  if (!isRecord(raw) || typeof raw.frameId !== 'string' || !findFrame(raw.frameId)) return null;
  const meta = parseUploadMeta(raw);
  if (!meta || !Number.isInteger(raw.version)) return null;
  const caption = cleanCaption(raw.caption);
  return {
    ...meta,
    frameId: raw.frameId,
    version: raw.version as number,
    ...(caption ? { caption } : {}),
  };
}

/** Validates GET /album on the phone; unknown frames and bad photos are dropped. */
export function parseListing(raw: unknown): AlbumListing {
  if (!isRecord(raw) || !isRecord(raw.frames) || !Array.isArray(raw.photos))
    throw new Error('Bad album listing');
  const frames: Record<string, AlbumFrameState> = {};
  for (const [id, state] of Object.entries(raw.frames)) {
    if (!findFrame(id) || !isRecord(state) || !Number.isInteger(state.version)) continue;
    const cover =
      typeof state.coverPhotoId === 'string' && PHOTO_ID.test(state.coverPhotoId)
        ? state.coverPhotoId
        : undefined;
    frames[id] = { version: state.version as number, ...(cover ? { coverPhotoId: cover } : {}) };
  }
  const photos = raw.photos.map(parsePhoto).filter((p): p is AlbumPhoto => p !== null);
  return { frames, photos };
}

export const parsePhotoResponse = (raw: unknown): AlbumPhoto => {
  const photo = parsePhoto(raw);
  if (!photo) throw new Error('Bad photo');
  return photo;
};
