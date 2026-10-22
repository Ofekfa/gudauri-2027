/**
 * The album on this phone: the server listing, the upload queue and the
 * optimistic changes in between. A module singleton, so uploads carry on
 * while you browse other pages.
 */
import { appStore } from '../storage/safeStorage';
import { syncSettings } from '../sync/settings';
import { toasts } from '../toast/toastStore';
import {
  applyMomentOps,
  keyAfter,
  mergeMoments,
  PENDING_MOMENT_PREFIX,
  type Moment,
  type MomentOp,
} from './moments';
import { processImage, UnsupportedImageError } from './pipeline';
import type { AlbumListing, AlbumPhoto, CustomMoment, ImageSize, MomentInput } from './protocol';
import {
  indexedDbQueueStore,
  createUploadQueue,
  metaOf,
  type QueueItem,
  type QueueView,
} from './queue';
import { createRemoteAlbumRepository, MOMENT_GONE } from './repository';
import { clearAlbumToken, getAlbumToken } from './token';
import { createUploader } from './uploader';

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
  /** Moment changes made here that the server hasn't confirmed yet (optimistic). */
  momentOps: MomentOp[];
}

const repo = createRemoteAlbumRepository();
const EMPTY: AlbumListing = { frames: {}, photos: [], moments: [] };
let snapshot: AlbumSnapshot = {
  listing: EMPTY,
  status: 'idle',
  queue: { items: [], progress: {} },
  previews: {},
  momentOps: [],
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
  upload: createUploader({ getToken: () => getAlbumToken(), clearToken: clearAlbumToken, repo }),
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
    // Someone deleted the moment: show it gone here too, without waiting for the next poll.
    if (event.item.error === MOMENT_GONE) void refreshAlbum();
    toasts.show({
      emoji: '⚠️',
      message: `Upload failed. ${event.item.error ?? 'A photo couldn’t be added.'}`,
    });
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
    // Photos still waiting for a moment someone deleted fail clearly, not silently.
    const known = new Set(momentsOf(snapshot).map((m) => m.id));
    void queue.failMissing((id) => known.has(id), MOMENT_GONE);
  } catch {
    update({ status: snapshot.status === 'ready' ? 'ready' : 'error' });
  }
}

export const getAlbum = () => snapshot;

let mergedCache: { moments: CustomMoment[]; ops: MomentOp[]; merged: Moment[] } | null = null;
/** Every moment in story order: predefined, ours, and our unconfirmed changes. */
export function momentsOf(s: AlbumSnapshot): Moment[] {
  if (mergedCache?.moments !== s.listing.moments || mergedCache.ops !== s.momentOps)
    mergedCache = {
      moments: s.listing.moments,
      ops: s.momentOps,
      merged: mergeMoments(applyMomentOps(s.listing.moments, s.momentOps)),
    };
  return mergedCache.merged;
}

export const isPendingMoment = (id: string) => id.startsWith(PENDING_MOMENT_PREFIX);
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
  const frame = momentsOf(snapshot).find((m) => m.id === frameId);
  if (!me || !frame || isPendingMoment(frameId) || files.length === 0) return;
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

// Moments -------------------------------------------------------------------

const withOp = (op: MomentOp) => update({ momentOps: [...snapshot.momentOps, op] });
const withoutOp = (op: MomentOp) =>
  update({ momentOps: snapshot.momentOps.filter((o) => o !== op) });
const putMoment = (moment: CustomMoment) =>
  setListing((l) => ({
    ...l,
    moments: [...l.moments.filter((m) => m.id !== moment.id), moment],
  }));
const momentFailed = (message: string) => toasts.show({ emoji: '⚠️', message });

/**
 * Adds one of our own moments. It shows at once (optimistic) and is replaced
 * by the server's copy; on failure it disappears again with a toast.
 * Resolves to the new moment's id, or null.
 */
export async function createMoment(input: MomentInput): Promise<string | null> {
  const me = syncSettings.get().me;
  if (!me) return null;
  const draft: CustomMoment = {
    id: `${PENDING_MOMENT_PREFIX}${crypto.randomUUID()}`,
    title: input.title,
    emoji: input.emoji,
    ...(input.prompt ? { prompt: input.prompt } : {}),
    orderKey: keyAfter(momentsOf(snapshot), input.after) ?? 'z',
    createdBy: me,
    createdAt: new Date().toISOString(),
    custom: true,
    version: 0,
  };
  const op: MomentOp = { kind: 'create', moment: draft };
  withOp(op);
  const auth = await getAlbumToken();
  const res = 'token' in auth ? await repo.createMoment(auth.token, input).catch(() => null) : null;
  if (res?.ok) putMoment(res.moment);
  withoutOp(op);
  if (!res?.ok) {
    momentFailed(`Couldn’t add “${input.title}”. ${res?.error ?? 'Check your connection.'}`);
    return null;
  }
  return res.moment.id;
}

/** Renames, re-emojis or moves one of our moments (only the fields given). */
export async function editMoment(id: string, patch: Partial<MomentInput>): Promise<boolean> {
  const changes: Partial<CustomMoment> = {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.emoji !== undefined ? { emoji: patch.emoji } : {}),
    ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
  };
  if (patch.after !== undefined) {
    const key = keyAfter(momentsOf(snapshot), patch.after, id);
    if (key) changes.orderKey = key;
  }
  const op: MomentOp = { kind: 'edit', id, changes };
  withOp(op);
  const auth = await getAlbumToken();
  const res =
    'token' in auth ? await repo.editMoment(auth.token, id, patch).catch(() => null) : null;
  if (res?.ok) putMoment(res.moment);
  withoutOp(op);
  if (res?.ok) return true;
  if (res?.status === 404) {
    momentFailed('Someone just deleted this moment.');
    void refreshAlbum();
  } else momentFailed(`Couldn’t save the moment. ${res?.error ?? 'Check your connection.'}`);
  return false;
}

/** Deletes one of our moments and all its photos, for everyone. */
export async function deleteMoment(id: string): Promise<boolean> {
  const op: MomentOp = { kind: 'delete', id };
  withOp(op);
  const auth = await getAlbumToken();
  const ok = 'token' in auth ? await repo.deleteMoment(auth.token, id).catch(() => false) : false;
  if (ok) {
    setListing((l) => ({
      ...l,
      moments: l.moments.filter((m) => m.id !== id),
      photos: l.photos.filter((p) => p.frameId !== id),
    }));
    // Photos still queued for it here would only fail; drop them with it.
    for (const item of snapshot.queue.items.filter((i) => i.frameId === id))
      await queue.cancel(item.id);
  }
  withoutOp(op);
  if (!ok) momentFailed('Couldn’t delete the moment. Try again when you’re online.');
  return ok;
}
