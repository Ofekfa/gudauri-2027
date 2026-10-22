/**
 * The album on this phone: the server listing, the upload queue and the
 * optimistic changes in between. A module singleton, so uploads carry on
 * while you browse other pages.
 */
import { findFrame } from '../../data/album';
import { appStore } from '../storage/safeStorage';
import { syncSettings } from '../sync/settings';
import { toasts } from '../toast/toastStore';
import { processImage, UnsupportedImageError } from './pipeline';
import type { AlbumListing, AlbumPhoto, ImageSize } from './protocol';
import {
  indexedDbQueueStore,
  createUploadQueue,
  metaOf,
  type QueueItem,
  type QueueView,
} from './queue';
import { createRemoteAlbumRepository } from './repository';
import { getAlbumToken } from './token';

/** Set while photos wait to upload, so the app shell resumes them after a reload. */
export const PENDING_FLAG_KEY = 'album:pending';
const UNDO_MS = 6_000;

export type ListingStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AlbumSnapshot {
  listing: AlbumListing;
  status: ListingStatus;
  queue: QueueView;
  /** Local previews (object URLs) of photos not yet uploaded. */
  previews: Record<string, string>;
}

const repo = createRemoteAlbumRepository();
const EMPTY: AlbumListing = { frames: {}, photos: [] };
let snapshot: AlbumSnapshot = {
  listing: EMPTY,
  status: 'idle',
  queue: { items: [], progress: {} },
  previews: {},
};
const listeners = new Set<(s: AlbumSnapshot) => void>();

function update(patch: Partial<AlbumSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l(snapshot));
}
const setListing = (fn: (l: AlbumListing) => AlbumListing) =>
  update({ listing: fn(snapshot.listing) });

const queue = createUploadQueue({
  store: indexedDbQueueStore(),
  async upload(item, onProgress) {
    const auth = await getAlbumToken();
    if ('error' in auth) return { kind: 'retry', status: 401 };
    return repo.upload(auth.token, item.frameId, metaOf(item), item.full, item.thumb, onProgress);
  },
  isOnline: () => navigator.onLine,
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
});

queue.subscribe((view) => {
  // Previews for items that left the queue are kept until the server copy shows.
  const previews = { ...snapshot.previews };
  for (const item of view.items) previews[item.id] ??= URL.createObjectURL(item.thumb);
  if (queue.pending()) appStore.set(PENDING_FLAG_KEY, '1');
  else appStore.remove(PENDING_FLAG_KEY);
  update({ queue: view, previews });
});

queue.onEvent((event) => {
  if (event.type === 'uploaded') {
    setListing((l) =>
      l.photos.some((p) => p.id === event.photo.id)
        ? l
        : { ...l, photos: [...l.photos, event.photo] },
    );
  } else if (event.type === 'failed') {
    toasts.show({ emoji: '⚠️', message: event.item.error ?? 'A photo couldn’t be added.' });
  } else {
    void removeRemote(event.photo.id);
  }
});

let started: Promise<void> | null = null;
/** Loads queued photos from earlier visits and listens for the network coming back. */
export function startAlbum(): Promise<void> {
  if (started) return started;
  window.addEventListener('online', () => void queue.resume());
  document.addEventListener(
    'visibilitychange',
    () => document.visibilityState === 'visible' && void queue.resume(),
  );
  window.addEventListener('beforeunload', (e) => {
    if (queue.pending()) e.preventDefault();
  });
  started = queue.start();
  return started;
}

export async function refreshAlbum(): Promise<void> {
  update({ status: snapshot.status === 'ready' ? 'ready' : 'loading' });
  try {
    const listing = await repo.list();
    // Drop previews whose photo the server now has.
    const previews = { ...snapshot.previews };
    for (const p of listing.photos) {
      if (previews[p.id] && !snapshot.queue.items.some((i) => i.id === p.id)) {
        URL.revokeObjectURL(previews[p.id]!);
        delete previews[p.id];
      }
    }
    update({ listing, status: 'ready', previews });
  } catch {
    update({ status: snapshot.status === 'ready' ? 'ready' : 'error' });
  }
}

export const getAlbum = () => snapshot;
export function subscribeAlbum(listener: (s: AlbumSnapshot) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const imageUrl = (photoId: string, size: ImageSize) =>
  snapshot.previews[photoId] ?? repo.imageUrl(photoId, size);
export const remoteImageUrl = (photoId: string, size: ImageSize) => repo.imageUrl(photoId, size);

/** Processes and queues photos for a frame; shows "Added" with Undo. */
export async function addPhotos(frameId: string, files: readonly File[]): Promise<void> {
  const me = syncSettings.get().me;
  const frame = findFrame(frameId);
  if (!me || !frame || files.length === 0) return;
  void startAlbum();
  const items: QueueItem[] = [];
  for (const file of files) {
    try {
      const p = await processImage(file);
      items.push({
        id: crypto.randomUUID(),
        frameId,
        uploadedBy: me,
        uploadedAt: new Date().toISOString(),
        ...p,
        attempts: 0,
        nextAttemptAt: 0,
        state: 'queued',
      });
    } catch (err) {
      toasts.show({
        emoji: '⚠️',
        message:
          err instanceof UnsupportedImageError ? err.message : 'That photo couldn’t be read.',
      });
    }
  }
  if (items.length === 0) return;
  const ids = items.map((i) => i.id);
  toasts.show({
    emoji: '📷',
    message: `${items.length > 1 ? `${items.length} photos` : 'Photo'} added to ${frame.title}`,
    durationMs: UNDO_MS,
    action: { label: 'Undo', onSelect: () => void undoAdd(ids) },
  });
  await queue.enqueue(items);
}

async function undoAdd(ids: readonly string[]) {
  for (const id of ids) {
    const queued = snapshot.queue.items.some((i) => i.id === id);
    // Mid-upload items are deleted from the server when they land ('undone-late').
    if (queued) await queue.cancel(id);
    else await removeRemote(id);
  }
}

async function removeRemote(id: string): Promise<boolean> {
  const before = snapshot.listing;
  setListing((l) => ({ ...l, photos: l.photos.filter((p) => p.id !== id) }));
  const auth = await getAlbumToken();
  const ok = 'token' in auth && (await repo.remove(auth.token, id).catch(() => false));
  if (!ok) {
    update({ listing: before });
    toasts.show({
      emoji: '⚠️',
      message: 'Couldn’t delete that photo. Try again when you’re online.',
    });
  }
  return ok;
}

/** Deletes a photo for everyone (uploaded or still queued). */
export async function deletePhoto(id: string): Promise<boolean> {
  if (snapshot.queue.items.some((i) => i.id === id)) {
    await queue.cancel(id);
    return true;
  }
  return removeRemote(id);
}

export const retryUpload = (id: string) => queue.retry(id);

const CONFLICT = 'Someone just updated this. Showing the latest.';

export async function editCaption(photo: AlbumPhoto, caption: string): Promise<boolean> {
  const auth = await getAlbumToken();
  if (!('token' in auth)) return false;
  const res = await repo.caption(auth.token, photo, caption).catch(() => null);
  const latest = res?.ok ? res.value : res?.conflict;
  if (latest)
    setListing((l) => ({ ...l, photos: l.photos.map((p) => (p.id === latest.id ? latest : p)) }));
  if (res && !res.ok && res.conflict) toasts.show({ emoji: '🔄', message: CONFLICT });
  else if (!res?.ok) toasts.show({ emoji: '⚠️', message: 'Couldn’t save the caption. Try again.' });
  return Boolean(res?.ok);
}

export async function makeCover(frameId: string, photoId: string): Promise<boolean> {
  const auth = await getAlbumToken();
  if (!('token' in auth)) return false;
  const version = snapshot.listing.frames[frameId]?.version ?? 0;
  const res = await repo.setCover(auth.token, frameId, photoId, version).catch(() => null);
  const latest = res?.ok ? res.value : res?.conflict;
  if (latest) setListing((l) => ({ ...l, frames: { ...l.frames, [frameId]: latest } }));
  if (res && !res.ok && res.conflict) toasts.show({ emoji: '🔄', message: CONFLICT });
  else if (!res?.ok) toasts.show({ emoji: '⚠️', message: 'Couldn’t set the cover. Try again.' });
  return Boolean(res?.ok);
}

/** Photos to show: the server's plus queued ones (as placeholders with local previews). */
export function visiblePhotos(s: AlbumSnapshot): AlbumPhoto[] {
  const known = new Set(s.listing.photos.map((p) => p.id));
  const pending = s.queue.items
    .filter((i) => !known.has(i.id))
    .map((i): AlbumPhoto => ({ ...metaOf(i), frameId: i.frameId, version: 0 }));
  return [...s.listing.photos, ...pending];
}
