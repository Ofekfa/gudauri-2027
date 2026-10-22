/**
 * Talks to the Worker's album routes. Viewing needs nothing; changes carry the
 * token. Uploads use XMLHttpRequest for progress.
 */
import { WORKER_URL } from '../worker/config';
import {
  parseListing,
  parseMomentResponse,
  parsePhotoResponse,
  type AlbumFrameState,
  type AlbumListing,
  type AlbumPhoto,
  type CustomMoment,
  type ImageSize,
  type MomentInput,
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
  createMoment(token: string, input: MomentInput): Promise<MomentOutcome>;
  editMoment(token: string, id: string, patch: Partial<MomentInput>): Promise<MomentOutcome>;
  /** True if it's gone (deleted now, or already). */
  deleteMoment(token: string, id: string): Promise<boolean>;
}

export type MomentOutcome =
  { ok: true; moment: CustomMoment } | { ok: false; status: number; error: string };

/** What happened to an upload: done, worth retrying later, or a definite failure. */
export type UploadOutcome =
  | { kind: 'done'; photo: AlbumPhoto }
  | { kind: 'retry'; status: number; reason?: string }
  | { kind: 'failed'; status: number; reason: string };

/** Upload refused because the moment was deleted (also used when the listing drops it). */
export const MOMENT_GONE = 'This moment was deleted.';

const FAILURE_REASON: Record<number, string> = {
  400: 'This photo couldn’t be added.',
  409: 'This frame is full (30 photos).',
  413: 'This photo is too large.',
  410: MOMENT_GONE,
  415: 'Only photos can be added.',
};

/** Why an upload that kept needing retries gave up (shown on the photo). */
export function retryReason(status: number, reason?: string): string {
  if (reason) return reason;
  if (status === 0) return 'No response from the server.';
  if (status === 401) return 'The album didn’t accept this phone. Re-join and try again.';
  if (status === 429) return 'Too many tries. Wait a minute and try again.';
  return `The server had a problem (${status}).`;
}

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

  async function moment(path: string, method: string, token: string, body: unknown) {
    const res = await fetch(url(path), {
      method,
      headers: json(token),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const raw: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true as const, moment: parseMomentResponse(raw) };
    const error = (raw as { error?: unknown } | null)?.error;
    return {
      ok: false as const,
      status: res.status,
      error: typeof error === 'string' ? error : `The server had a problem (${res.status}).`,
    };
  }

  return {
    createMoment: (token, input) => moment('/album/moments', 'POST', token, input),
    editMoment: (token, id, patch) =>
      moment(`/album/moments/${encodeURIComponent(id)}`, 'PATCH', token, patch),
    async deleteMoment(token, id) {
      const res = await fetch(url(`/album/moments/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return res.ok || res.status === 404;
    },
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
        xhr.onerror = () => resolve({ kind: 'retry', status: 0 });
        xhr.ontimeout = () =>
          resolve({ kind: 'retry', status: 0, reason: 'The upload took too long.' });
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
