/**
 * Album rules over a tiny storage interface: memory in tests, Durable Object
 * SQLite in production. The index holds metadata and covers; each frame's
 * object holds that frame's image bytes.
 */
import { MAX_PHOTOS_PER_FRAME } from '../../../src/data/album';
import type { TravelerId } from '../../../src/data/trip';
import { keyAfter, mergeMoments } from '../../../src/lib/album/moments';
import {
  MAX_CUSTOM_MOMENTS,
  MOMENT_ID,
  type AlbumFrameState,
  type AlbumListing,
  type AlbumPhoto,
  type CustomMoment,
  type ImageSize,
  type MomentInput,
} from '../../../src/lib/album/protocol';

export interface IndexDb {
  getPhoto(id: string): AlbumPhoto | null;
  putPhoto(photo: AlbumPhoto): void;
  deletePhoto(id: string): void;
  listPhotos(): AlbumPhoto[];
  countInFrame(frameId: string): number;
  getFrame(frameId: string): AlbumFrameState | null;
  putFrame(frameId: string, state: AlbumFrameState): void;
  listFrames(): Record<string, AlbumFrameState>;
  deleteFrame(frameId: string): void;
  photosInFrame(frameId: string): AlbumPhoto[];
  getMoment(id: string): CustomMoment | null;
  putMoment(moment: CustomMoment): void;
  deleteMoment(id: string): void;
  listMoments(): CustomMoment[];
}

export interface ImageDb {
  put(photoId: string, size: ImageSize, bytes: Uint8Array): void;
  get(photoId: string, size: ImageSize): Uint8Array | null;
  delete(photoId: string): void;
  deleteAll(): void;
}

export type AddResult =
  | { status: 'created' | 'exists'; photo: AlbumPhoto }
  | { status: 'full' }
  /** The custom moment was deleted meanwhile. */
  | { status: 'gone' };
export type MomentResult =
  { status: 'created' | 'ok'; moment: CustomMoment } | { status: 'missing' | 'bad-place' | 'full' };
export type EditResult<T> =
  { status: 'ok'; value: T } | { status: 'conflict'; value: T } | { status: 'missing' };

export const listing = (db: IndexDb): AlbumListing => ({
  frames: db.listFrames(),
  moments: db.listMoments(),
  photos: db
    .listPhotos()
    .sort((a, b) =>
      a.uploadedAt < b.uploadedAt ? -1 : a.uploadedAt > b.uploadedAt ? 1 : a.id < b.id ? -1 : 1,
    ),
});

export function addPhoto(db: IndexDb, photo: AlbumPhoto): AddResult {
  const existing = db.getPhoto(photo.id);
  if (existing) return { status: 'exists', photo: existing };
  if (MOMENT_ID.test(photo.frameId) && !db.getMoment(photo.frameId)) return { status: 'gone' };
  if (db.countInFrame(photo.frameId) >= MAX_PHOTOS_PER_FRAME) return { status: 'full' };
  db.putPhoto(photo);
  return { status: 'created', photo };
}

/** `ifMatch` null skips the version check. */
export function setCaption(
  db: IndexDb,
  id: string,
  caption: string | undefined,
  ifMatch: number | null,
): EditResult<AlbumPhoto> {
  const photo = db.getPhoto(id);
  if (!photo) return { status: 'missing' };
  if (ifMatch !== null && ifMatch !== photo.version) return { status: 'conflict', value: photo };
  const next: AlbumPhoto = { ...photo, caption, version: photo.version + 1 };
  if (!caption) delete next.caption;
  db.putPhoto(next);
  return { status: 'ok', value: next };
}

export function setCover(
  db: IndexDb,
  frameId: string,
  photoId: string,
  ifMatch: number | null,
): EditResult<AlbumFrameState> {
  const photo = db.getPhoto(photoId);
  if (!photo || photo.frameId !== frameId) return { status: 'missing' };
  const current = db.getFrame(frameId) ?? { version: 0 };
  if (ifMatch !== null && ifMatch !== current.version)
    return { status: 'conflict', value: current };
  const next = { coverPhotoId: photoId, version: current.version + 1 };
  db.putFrame(frameId, next);
  return { status: 'ok', value: next };
}

/** Removes the photo's metadata; a cover pointing at it falls back to the default. */
export function removePhoto(db: IndexDb, id: string): AlbumPhoto | null {
  const photo = db.getPhoto(id);
  if (!photo) return null;
  db.deletePhoto(id);
  const frame = db.getFrame(photo.frameId);
  if (frame?.coverPhotoId === id) db.putFrame(photo.frameId, { version: frame.version + 1 });
  return photo;
}

/** Adds a custom moment right after `input.after` (any moment, ours or predefined). */
export function createMoment(
  db: IndexDb,
  input: MomentInput,
  meta: { id: string; createdBy: TravelerId; createdAt: string },
): MomentResult {
  const moments = db.listMoments();
  if (moments.length >= MAX_CUSTOM_MOMENTS) return { status: 'full' };
  const orderKey = keyAfter(mergeMoments(moments), input.after);
  if (!orderKey) return { status: 'bad-place' };
  const moment: CustomMoment = {
    id: meta.id,
    title: input.title,
    emoji: input.emoji,
    ...(input.prompt ? { prompt: input.prompt } : {}),
    orderKey,
    createdBy: meta.createdBy,
    createdAt: meta.createdAt,
    custom: true,
    version: 1,
  };
  db.putMoment(moment);
  return { status: 'created', moment };
}

/** Changes only the given fields, so two people editing different ones both keep theirs. */
export function updateMoment(db: IndexDb, id: string, patch: Partial<MomentInput>): MomentResult {
  const current = db.getMoment(id);
  if (!current) return { status: 'missing' };
  let orderKey = current.orderKey;
  if (patch.after !== undefined) {
    const key = keyAfter(mergeMoments(db.listMoments()), patch.after, id);
    if (!key) return { status: 'bad-place' };
    orderKey = key;
  }
  const next: CustomMoment = {
    ...current,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.emoji !== undefined ? { emoji: patch.emoji } : {}),
    orderKey,
    version: current.version + 1,
  };
  if (patch.prompt !== undefined) {
    if (patch.prompt) next.prompt = patch.prompt;
    else delete next.prompt;
  }
  db.putMoment(next);
  return { status: 'ok', moment: next };
}

/** Removes the moment with its photos and cover; returns the photo ids (for their images). */
export function deleteMoment(db: IndexDb, id: string): string[] | null {
  if (!db.getMoment(id)) return null;
  const photoIds = db.photosInFrame(id).map((p) => p.id);
  photoIds.forEach((photoId) => db.deletePhoto(photoId));
  db.deleteFrame(id);
  db.deleteMoment(id);
  return photoIds;
}

export function memoryIndexDb(): IndexDb {
  const photos = new Map<string, AlbumPhoto>();
  const frames = new Map<string, AlbumFrameState>();
  const moments = new Map<string, CustomMoment>();
  return {
    getPhoto: (id) => photos.get(id) ?? null,
    putPhoto: (p) => void photos.set(p.id, p),
    deletePhoto: (id) => void photos.delete(id),
    listPhotos: () => [...photos.values()],
    countInFrame: (frameId) => [...photos.values()].filter((p) => p.frameId === frameId).length,
    getFrame: (id) => frames.get(id) ?? null,
    putFrame: (id, s) => void frames.set(id, s),
    listFrames: () => Object.fromEntries(frames),
    deleteFrame: (id) => void frames.delete(id),
    photosInFrame: (frameId) => [...photos.values()].filter((p) => p.frameId === frameId),
    getMoment: (id) => moments.get(id) ?? null,
    putMoment: (m) => void moments.set(m.id, m),
    deleteMoment: (id) => void moments.delete(id),
    listMoments: () => [...moments.values()],
  };
}

export function memoryImageDb(): ImageDb {
  const images = new Map<string, Uint8Array>();
  return {
    put: (id, size, bytes) => void images.set(`${id}/${size}`, bytes),
    get: (id, size) => images.get(`${id}/${size}`) ?? null,
    delete: (id) => {
      images.delete(`${id}/thumb`);
      images.delete(`${id}/full`);
    },
    deleteAll: () => images.clear(),
  };
}
