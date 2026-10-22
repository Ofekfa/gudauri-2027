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

/** A moment one of us added on the site (predefined ones live in src/data/album.ts). */
export interface CustomMoment {
  /** Server-made: "m-" + 10 base-36 characters. */
  id: string;
  title: string;
  emoji: string;
  prompt?: string;
  /** Fractional order key (see moments.ts). */
  orderKey: string;
  createdBy: TravelerId;
  /** ISO 8601. */
  createdAt: string;
  custom: true;
  /** Bumped on every edit. */
  version: number;
}

export interface AlbumListing {
  frames: Record<string, AlbumFrameState>;
  photos: AlbumPhoto[];
  moments: CustomMoment[];
}

export const MOMENT_ID = /^m-[0-9a-z]{10}$/;
export const MAX_MOMENT_TITLE = 40;
export const MAX_MOMENT_PROMPT = 80;
export const MAX_CUSTOM_MOMENTS = 30;
/** The emoji a custom moment can have, with names for screen readers. */
export const MOMENT_EMOJIS = [
  { emoji: '🥐', name: 'Croissant' },
  { emoji: '☕', name: 'Coffee' },
  { emoji: '🍳', name: 'Breakfast' },
  { emoji: '🥾', name: 'Hiking boot' },
  { emoji: '🏂', name: 'Snowboarder' },
  { emoji: '🛷', name: 'Sled' },
  { emoji: '🧗', name: 'Climbing' },
  { emoji: '📸', name: 'Camera' },
  { emoji: '🎉', name: 'Party' },
  { emoji: '🃏', name: 'Cards' },
  { emoji: '🎶', name: 'Music' },
  { emoji: '🛍️', name: 'Shopping' },
  { emoji: '🚶', name: 'Walk' },
  { emoji: '♨️', name: 'Hot spring' },
  { emoji: '🌅', name: 'Sunrise' },
  { emoji: '🍷', name: 'Wine' },
] as const;
export const isMomentEmoji = (v: unknown): v is string => MOMENT_EMOJIS.some((e) => e.emoji === v);

/** What the phone sends with an upload (the server adds `frameId` and `version`). */
export type UploadMeta = Omit<AlbumPhoto, 'frameId' | 'version' | 'caption'>;

const TRAVELERS = trip.travelers.map((t) => t.id);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isDim = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) > 0 && (v as number) <= MAX_IMAGE_EDGE;

/** Trimmed, single-line, control and invisible format characters removed. Empty → undefined. */
export function cleanText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || undefined;
}

/** A caption, length-capped. */
export const cleanCaption = (raw: unknown): string | undefined =>
  cleanText(raw)?.slice(0, MAX_CAPTION_CHARS);

export interface MomentInput {
  title: string;
  emoji: string;
  /** Empty string clears it on edit. */
  prompt?: string;
  /** Place right after this moment. */
  after: string;
}

const lengthOf = (text: string) => [...text].length;

/**
 * Validates a new moment (`partial` false) or an edit (`partial` true: any
 * subset of fields). Returns the cleaned fields or the reason it's invalid.
 */
export function parseMomentInput(
  raw: unknown,
  partial: boolean,
): { ok: true; value: Partial<MomentInput> } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: 'Invalid request' };
  const value: Partial<MomentInput> = {};
  if (raw.title !== undefined || !partial) {
    const title = cleanText(raw.title);
    if (!title) return { ok: false, error: 'A title is needed' };
    if (lengthOf(title) > MAX_MOMENT_TITLE)
      return { ok: false, error: `Titles are up to ${MAX_MOMENT_TITLE} characters` };
    value.title = title;
  }
  if (raw.emoji !== undefined || !partial) {
    if (!isMomentEmoji(raw.emoji)) return { ok: false, error: 'Pick one of the emoji' };
    value.emoji = raw.emoji;
  }
  if (raw.prompt !== undefined && raw.prompt !== null) {
    if (typeof raw.prompt !== 'string') return { ok: false, error: 'Invalid prompt' };
    const prompt = cleanText(raw.prompt) ?? '';
    if (lengthOf(prompt) > MAX_MOMENT_PROMPT)
      return { ok: false, error: `Prompts are up to ${MAX_MOMENT_PROMPT} characters` };
    value.prompt = prompt;
  }
  if (raw.after !== undefined || !partial) {
    if (typeof raw.after !== 'string' || !raw.after) return { ok: false, error: 'Pick a place' };
    value.after = raw.after;
  }
  if (partial && Object.keys(value).length === 0) return { ok: false, error: 'Nothing to change' };
  return { ok: true, value };
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

/** A predefined frame id or the shape of a custom moment's id. */
export const isFrameId = (id: unknown): id is string =>
  typeof id === 'string' && (Boolean(findFrame(id)) || MOMENT_ID.test(id));

function parsePhoto(raw: unknown): AlbumPhoto | null {
  if (!isRecord(raw) || !isFrameId(raw.frameId)) return null;
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

export function parseMoment(raw: unknown): CustomMoment | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !MOMENT_ID.test(raw.id)) return null;
  const input = parseMomentInput({ ...raw, after: 'x' }, false);
  if (!input.ok) return null;
  const { orderKey, createdBy, createdAt, version } = raw;
  if (typeof orderKey !== 'string' || !/^[0-9a-z]{1,64}$/.test(orderKey)) return null;
  if (!TRAVELERS.includes(createdBy as TravelerId)) return null;
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null;
  if (!Number.isInteger(version)) return null;
  const { title, emoji, prompt } = input.value;
  return {
    id: raw.id,
    title: title!,
    emoji: emoji!,
    ...(prompt ? { prompt } : {}),
    orderKey,
    createdBy: createdBy as TravelerId,
    createdAt,
    custom: true,
    version: version as number,
  };
}

export const parseMomentResponse = (raw: unknown): CustomMoment => {
  const moment = parseMoment(raw);
  if (!moment) throw new Error('Bad moment');
  return moment;
};

/**
 * Validates GET /album on the phone; bad entries, and photos or covers of
 * moments that don't exist (any more), are dropped. `moments` is optional
 * for replies from an older Worker.
 */
export function parseListing(raw: unknown): AlbumListing {
  if (!isRecord(raw) || !isRecord(raw.frames) || !Array.isArray(raw.photos))
    throw new Error('Bad album listing');
  const moments = (Array.isArray(raw.moments) ? raw.moments : [])
    .map(parseMoment)
    .filter((m): m is CustomMoment => m !== null);
  const known = (id: string) => Boolean(findFrame(id)) || moments.some((m) => m.id === id);
  const frames: Record<string, AlbumFrameState> = {};
  for (const [id, state] of Object.entries(raw.frames)) {
    if (!known(id) || !isRecord(state) || !Number.isInteger(state.version)) continue;
    const cover =
      typeof state.coverPhotoId === 'string' && PHOTO_ID.test(state.coverPhotoId)
        ? state.coverPhotoId
        : undefined;
    frames[id] = { version: state.version as number, ...(cover ? { coverPhotoId: cover } : {}) };
  }
  const photos = raw.photos
    .map(parsePhoto)
    .filter((p): p is AlbumPhoto => p !== null && known(p.frameId));
  return { frames, photos, moments };
}

export const parsePhotoResponse = (raw: unknown): AlbumPhoto => {
  const photo = parsePhoto(raw);
  if (!photo) throw new Error('Bad photo');
  return photo;
};
