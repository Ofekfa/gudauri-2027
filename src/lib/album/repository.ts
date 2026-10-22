/**
 * Talks to the Worker's album routes. Viewing needs nothing; changes carry the
 * token. Uploads use XMLHttpRequest for progress.
 */
import { WORKER_URL } from '../worker/config';
import {
  parseListing,
  parsePhotoResponse,
  type AlbumFrameState,
  type AlbumListing,
  type AlbumPhoto,
  type ImageSize,
  type UploadMeta,
} from './protocol';

const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 120_000;

export type EditOutcome<T> = { ok: true; value: T } | { ok: false; conflict?: T; status: number };

export interface AlbumRepository {
  list(): Promise<AlbumListing>;
  imageUrl(photoId: string, size: ImageSize): string;
  upload(
    token: string,
    frameId: string,
    meta: UploadMeta,
    full: Blob,
    thumb: Blob,
    onProgress: (fraction: number) => void,
  ): Promise<UploadOutcome>;
  caption(token: string, photo: AlbumPhoto, caption: string): Promise<EditOutcome<AlbumPhoto>>;
  setCover(
    token: string,
    frameId: string,
    photoId: string,
    version: number,
  ): Promise<EditOutcome<AlbumFrameState>>;
  remove(token: string, photoId: string): Promise<boolean>;
}

/** What happened to an upload: done, worth retrying later, or a definite failure. */
export type UploadOutcome =
  | { kind: 'done'; photo: AlbumPhoto }
  | { kind: 'retry'; status: number }
  | { kind: 'failed'; status: number; reason: string };

const FAILURE_REASON: Record<number, string> = {
  400: 'This photo couldn’t be added.',
  409: 'This frame is full (30 photos).',
  413: 'This photo is too large.',
  415: 'Only photos can be added.',
};

export function createRemoteAlbumRepository(base: string | null = WORKER_URL): AlbumRepository {
  const url = (path: string) => `${base}${path}`;
  const json = (token: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  async function edit<T>(
    path: string,
    method: string,
    token: string,
    version: number,
    body: unknown,
    parse: (raw: unknown) => T,
  ): Promise<EditOutcome<T>> {
    const res = await fetch(url(path), {
      method,
      headers: { ...json(token), 'If-Match': `"${version}"` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true, value: parse(await res.json()) };
    if (res.status === 409) {
      const { current } = (await res.json()) as { current: unknown };
      return { ok: false, status: 409, conflict: parse(current) };
    }
    return { ok: false, status: res.status };
  }

  return {
    async list() {
      const res = await fetch(url('/album'), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Album unavailable (${res.status})`);
      return parseListing(await res.json());
    },
    imageUrl: (photoId, size) =>
      url(`/album/photos/${encodeURIComponent(photoId)}/image?size=${size}`),
    upload(token, frameId, meta, full, thumb, onProgress) {
      return new Promise((resolve) => {
        const form = new FormData();
        form.set('meta', JSON.stringify(meta));
        form.set('full', full, 'full.jpg');
        form.set('thumb', thumb, 'thumb.jpg');
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url(`/album/${encodeURIComponent(frameId)}/photos`));
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = UPLOAD_TIMEOUT_MS;
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              resolve({ kind: 'done', photo: parsePhotoResponse(JSON.parse(xhr.responseText)) });
            } catch {
              resolve({ kind: 'retry', status: xhr.status });
            }
          } else if (FAILURE_REASON[xhr.status]) {
            resolve({ kind: 'failed', status: xhr.status, reason: FAILURE_REASON[xhr.status]! });
          } else {
            // 401 (token), 429, 5xx: try again later.
            resolve({ kind: 'retry', status: xhr.status });
          }
        };
        xhr.onerror = xhr.ontimeout = () => resolve({ kind: 'retry', status: 0 });
        xhr.send(form);
      });
    },
    caption: (token, photo, caption) =>
      edit(
        `/album/photos/${encodeURIComponent(photo.id)}`,
        'PATCH',
        token,
        photo.version,
        { caption },
        parsePhotoResponse,
      ),
    setCover: (token, frameId, photoId, version) =>
      edit(
        `/album/${encodeURIComponent(frameId)}/cover`,
        'PUT',
        token,
        version,
        { photoId },
        (raw) => raw as AlbumFrameState,
      ),
    async remove(token, photoId) {
      const res = await fetch(url(`/album/photos/${encodeURIComponent(photoId)}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return res.ok;
    },
  };
}
