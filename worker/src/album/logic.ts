/**
 * Album rules over a tiny storage interface: memory in tests, Durable Object
 * SQLite in production. The index holds metadata and covers; each frame's
 * object holds that frame's image bytes.
 */
import { MAX_PHOTOS_PER_FRAME } from '../../../src/data/album';
import type {
  AlbumFrameState,
  AlbumListing,
  AlbumPhoto,
  ImageSize,
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
}

export interface ImageDb {
  put(photoId: string, size: ImageSize, bytes: Uint8Array): void;
  get(photoId: string, size: ImageSize): Uint8Array | null;
  delete(photoId: string): void;
}

export type AddResult = { status: 'created' | 'exists'; photo: AlbumPhoto } | { status: 'full' };
export type EditResult<T> =
  { status: 'ok'; value: T } | { status: 'conflict'; value: T } | { status: 'missing' };

export const listing = (db: IndexDb): AlbumListing => ({
  frames: db.listFrames(),
  photos: db
    .listPhotos()
    .sort((a, b) =>
      a.uploadedAt < b.uploadedAt ? -1 : a.uploadedAt > b.uploadedAt ? 1 : a.id < b.id ? -1 : 1,
    ),
});

export function addPhoto(db: IndexDb, photo: AlbumPhoto): AddResult {
  const existing = db.getPhoto(photo.id);
  if (existing) return { status: 'exists', photo: existing };
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

export function memoryIndexDb(): IndexDb {
  const photos = new Map<string, AlbumPhoto>();
  const frames = new Map<string, AlbumFrameState>();
  return {
    getPhoto: (id) => photos.get(id) ?? null,
    putPhoto: (p) => void photos.set(p.id, p),
    deletePhoto: (id) => void photos.delete(id),
    listPhotos: () => [...photos.values()],
    countInFrame: (frameId) => [...photos.values()].filter((p) => p.frameId === frameId).length,
    getFrame: (id) => frames.get(id) ?? null,
    putFrame: (id, s) => void frames.set(id, s),
    listFrames: () => Object.fromEntries(frames),
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
  };
}
