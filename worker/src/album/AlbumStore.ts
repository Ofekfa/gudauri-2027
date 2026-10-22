/**
 * Durable Object for the album (SQLite). One instance named "index" holds
 * metadata; one instance per frame ("frame:<id>") holds that frame's images,
 * so no single object grows large (Free plan: 2 MB per row, 5 GB in total).
 */
import { DurableObject } from 'cloudflare:workers';
import type {
  AlbumFrameState,
  AlbumListing,
  AlbumPhoto,
  CustomMoment,
  ImageSize,
  MomentInput,
} from '../../../src/lib/album/protocol';
import type { Env } from '../env';
import type { TravelerId } from '../../../src/data/trip';
import {
  addPhoto,
  createMoment,
  deleteMoment,
  listing,
  removePhoto,
  setCaption,
  setCover,
  updateMoment,
  type AddResult,
  type EditResult,
  type ImageDb,
  type IndexDb,
  type MomentResult,
} from './logic';

interface MomentRow extends Record<string, SqlStorageValue> {
  id: string;
  title: string;
  emoji: string;
  prompt: string | null;
  order_key: string;
  created_by: string;
  created_at: string;
  version: number;
}

const toMoment = (r: MomentRow): CustomMoment => ({
  id: r.id,
  title: r.title,
  emoji: r.emoji,
  ...(r.prompt ? { prompt: r.prompt } : {}),
  orderKey: r.order_key,
  createdBy: r.created_by as TravelerId,
  createdAt: r.created_at,
  custom: true,
  version: r.version,
});

interface PhotoRow extends Record<string, SqlStorageValue> {
  id: string;
  frame_id: string;
  uploaded_by: string;
  uploaded_at: string;
  caption: string | null;
  width: number;
  height: number;
  thumb_w: number;
  thumb_h: number;
  version: number;
}

const toPhoto = (r: PhotoRow): AlbumPhoto =>
  ({
    id: r.id,
    frameId: r.frame_id,
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
    ...(r.caption ? { caption: r.caption } : {}),
    width: r.width,
    height: r.height,
    thumbWidth: r.thumb_w,
    thumbHeight: r.thumb_h,
    version: r.version,
  }) as AlbumPhoto;

function sqlIndexDb(sql: SqlStorage): IndexDb {
  sql.exec(`CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, frame_id TEXT NOT NULL, uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL, caption TEXT, width INTEGER NOT NULL, height INTEGER NOT NULL,
    thumb_w INTEGER NOT NULL, thumb_h INTEGER NOT NULL, version INTEGER NOT NULL)`);
  sql.exec(
    'CREATE TABLE IF NOT EXISTS frames (frame_id TEXT PRIMARY KEY, cover_photo_id TEXT, version INTEGER NOT NULL)',
  );
  sql.exec(`CREATE TABLE IF NOT EXISTS moments (id TEXT PRIMARY KEY, title TEXT NOT NULL, emoji TEXT NOT NULL,
    prompt TEXT, order_key TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, version INTEGER NOT NULL)`);
  const frameRow = (r: {
    frame_id: string;
    cover_photo_id: string | null;
    version: number;
  }): [string, AlbumFrameState] => [
    r.frame_id,
    { version: r.version, ...(r.cover_photo_id ? { coverPhotoId: r.cover_photo_id } : {}) },
  ];
  return {
    getPhoto: (id) => {
      const row = sql.exec<PhotoRow>('SELECT * FROM photos WHERE id = ?', id).toArray()[0];
      return row ? toPhoto(row) : null;
    },
    putPhoto: (p) => {
      sql.exec(
        `INSERT INTO photos (id, frame_id, uploaded_by, uploaded_at, caption, width, height, thumb_w, thumb_h, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET caption = excluded.caption, version = excluded.version`,
        p.id,
        p.frameId,
        p.uploadedBy,
        p.uploadedAt,
        p.caption ?? null,
        p.width,
        p.height,
        p.thumbWidth,
        p.thumbHeight,
        p.version,
      );
    },
    deletePhoto: (id) => void sql.exec('DELETE FROM photos WHERE id = ?', id),
    listPhotos: () => sql.exec<PhotoRow>('SELECT * FROM photos').toArray().map(toPhoto),
    countInFrame: (frameId) =>
      sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM photos WHERE frame_id = ?', frameId).one()
        .n,
    getFrame: (id) => {
      const row = sql
        .exec<{ frame_id: string; cover_photo_id: string | null; version: number }>(
          'SELECT * FROM frames WHERE frame_id = ?',
          id,
        )
        .toArray()[0];
      return row ? frameRow(row)[1] : null;
    },
    putFrame: (id, s) => {
      sql.exec(
        'INSERT INTO frames (frame_id, cover_photo_id, version) VALUES (?, ?, ?) ON CONFLICT (frame_id) DO UPDATE SET cover_photo_id = excluded.cover_photo_id, version = excluded.version',
        id,
        s.coverPhotoId ?? null,
        s.version,
      );
    },
    listFrames: () =>
      Object.fromEntries(
        sql
          .exec<{ frame_id: string; cover_photo_id: string | null; version: number }>(
            'SELECT * FROM frames',
          )
          .toArray()
          .map(frameRow),
      ),
    deleteFrame: (id) => void sql.exec('DELETE FROM frames WHERE frame_id = ?', id),
    photosInFrame: (frameId) =>
      sql.exec<PhotoRow>('SELECT * FROM photos WHERE frame_id = ?', frameId).toArray().map(toPhoto),
    getMoment: (id) => {
      const row = sql.exec<MomentRow>('SELECT * FROM moments WHERE id = ?', id).toArray()[0];
      return row ? toMoment(row) : null;
    },
    putMoment: (m) => {
      sql.exec(
        `INSERT INTO moments (id, title, emoji, prompt, order_key, created_by, created_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET title = excluded.title,
         emoji = excluded.emoji, prompt = excluded.prompt, order_key = excluded.order_key, version = excluded.version`,
        m.id,
        m.title,
        m.emoji,
        m.prompt ?? null,
        m.orderKey,
        m.createdBy,
        m.createdAt,
        m.version,
      );
    },
    deleteMoment: (id) => void sql.exec('DELETE FROM moments WHERE id = ?', id),
    listMoments: () => sql.exec<MomentRow>('SELECT * FROM moments').toArray().map(toMoment),
  };
}

function sqlImageDb(sql: SqlStorage): ImageDb {
  sql.exec(
    'CREATE TABLE IF NOT EXISTS images (photo_id TEXT NOT NULL, size TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY (photo_id, size))',
  );
  return {
    put: (id, size, bytes) => {
      // Bound as a parameter (never inlined in SQL); stored as a binary BLOB.
      sql.exec(
        'INSERT OR REPLACE INTO images (photo_id, size, bytes) VALUES (?, ?, ?)',
        id,
        size,
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      );
    },
    get: (id, size) => {
      const row = sql
        .exec<{ bytes: ArrayBuffer }>(
          'SELECT bytes FROM images WHERE photo_id = ? AND size = ?',
          id,
          size,
        )
        .toArray()[0];
      return row ? new Uint8Array(row.bytes) : null;
    },
    delete: (id) => void sql.exec('DELETE FROM images WHERE photo_id = ?', id),
    deleteAll: () => void sql.exec('DELETE FROM images'),
  };
}

export class AlbumStore extends DurableObject<Env> {
  private indexDb: IndexDb | null = null;
  private imageDb: ImageDb | null = null;

  private get index() {
    return (this.indexDb ??= sqlIndexDb(this.ctx.storage.sql));
  }
  private get images() {
    return (this.imageDb ??= sqlImageDb(this.ctx.storage.sql));
  }

  // Index instance -----------------------------------------------------
  list(): AlbumListing {
    return listing(this.index);
  }
  getPhoto(id: string): AlbumPhoto | null {
    return this.index.getPhoto(id);
  }
  addPhoto(photo: AlbumPhoto): AddResult {
    return this.ctx.storage.transactionSync(() => addPhoto(this.index, photo));
  }
  setCaption(
    id: string,
    caption: string | undefined,
    ifMatch: number | null,
  ): EditResult<AlbumPhoto> {
    return this.ctx.storage.transactionSync(() => setCaption(this.index, id, caption, ifMatch));
  }
  setCover(frameId: string, photoId: string, ifMatch: number | null): EditResult<AlbumFrameState> {
    return this.ctx.storage.transactionSync(() => setCover(this.index, frameId, photoId, ifMatch));
  }
  removePhoto(id: string): AlbumPhoto | null {
    return this.ctx.storage.transactionSync(() => removePhoto(this.index, id));
  }
  getMoment(id: string): CustomMoment | null {
    return this.index.getMoment(id);
  }
  createMoment(
    input: MomentInput,
    meta: { id: string; createdBy: TravelerId; createdAt: string },
  ): MomentResult {
    return this.ctx.storage.transactionSync(() => createMoment(this.index, input, meta));
  }
  updateMoment(id: string, patch: Partial<MomentInput>): MomentResult {
    return this.ctx.storage.transactionSync(() => updateMoment(this.index, id, patch));
  }
  deleteMoment(id: string): string[] | null {
    return this.ctx.storage.transactionSync(() => deleteMoment(this.index, id));
  }

  // Frame instances ----------------------------------------------------
  putImages(photoId: string, full: Uint8Array, thumb: Uint8Array): void {
    this.ctx.storage.transactionSync(() => {
      this.images.put(photoId, 'full', full);
      this.images.put(photoId, 'thumb', thumb);
    });
  }
  getImage(photoId: string, size: ImageSize): Uint8Array | null {
    return this.images.get(photoId, size);
  }
  deleteImages(photoId: string): void {
    this.images.delete(photoId);
  }
  /** A deleted custom moment: drop every image it held. */
  deleteAllImages(): void {
    this.images.deleteAll();
  }
}
