/**
 * Upload queue for album photos: processed images wait in IndexedDB until
 * they're uploaded, two at a time, retrying with exponential backoff and
 * resuming after reloads or when the phone is back online. After
 * MAX_ATTEMPTS online tries a photo is marked failed (with the reason), so it
 * can be retried by hand instead of spinning forever.
 */
import type { TravelerId } from '../../data/trip';
import type { AlbumPhoto, UploadMeta } from './protocol';
import { backoffMs } from '../net/backoff';
import { retryReason, type UploadOutcome } from './repository';

export type QueueState = 'queued' | 'uploading' | 'waiting-offline' | 'failed';

export interface QueueItem {
  id: string;
  frameId: string;
  uploadedBy: TravelerId;
  uploadedAt: string;
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
  attempts: number;
  nextAttemptAt: number;
  state: QueueState;
  /** Why it failed for good (shown on the tile). */
  error?: string;
}

/** Storage for queued photos (IndexedDB in the browser, memory in tests). */
export interface QueueStore {
  all(): Promise<QueueItem[]>;
  put(item: QueueItem): Promise<void>;
  delete(id: string): Promise<void>;
}

export const MAX_PARALLEL_UPLOADS = 2;
export { BASE_BACKOFF_MS, MAX_BACKOFF_MS, backoffMs } from '../net/backoff';
/** Online tries before a photo is marked failed (2+4+8+16 s of backoff in between). */
export const MAX_ATTEMPTS = 5;
/** Longest one attempt (token + upload) may take; above the upload's own timeout. */
export const ATTEMPT_TIMEOUT_MS = 3 * 60_000;

export interface QueueDeps {
  store: QueueStore;
  /** Gets a token and uploads. */
  upload(item: QueueItem, onProgress: (fraction: number) => void): Promise<UploadOutcome>;
  isOnline(): boolean;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  random?: () => number;
}

export interface QueueView {
  items: QueueItem[];
  progress: Record<string, number>;
}

export type QueueEvent =
  | { type: 'uploaded'; item: QueueItem; photo: AlbumPhoto }
  | { type: 'failed'; item: QueueItem }
  /** Undone while it was uploading, but it landed: delete the server copy. */
  | { type: 'undone-late'; photo: AlbumPhoto };

export function createUploadQueue(deps: QueueDeps) {
  let items: QueueItem[] = [];
  const progress: Record<string, number> = {};
  const running = new Set<string>();
  const cancelled = new Set<string>();
  const listeners = new Set<(view: QueueView) => void>();
  const eventListeners = new Set<(event: QueueEvent) => void>();
  let timer: unknown = null;
  let loaded = false;

  const emit = () => {
    const view = { items: [...items], progress: { ...progress } };
    listeners.forEach((l) => l(view));
  };
  const save = async (item: QueueItem) => {
    items = items.map((i) => (i.id === item.id ? item : i));
    await deps.store.put(item);
    emit();
  };

  function schedule() {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
    const waiting = items.filter((i) => i.state === 'queued' && !running.has(i.id));
    if (waiting.length === 0) return;
    const next = Math.min(...waiting.map((i) => i.nextAttemptAt));
    timer = deps.setTimer(() => void pump(), Math.max(0, next - deps.now()));
  }

  /** One attempt that always settles: a throw or a hang counts as "retry". */
  function attempt(item: QueueItem): Promise<UploadOutcome> {
    let settled = false;
    let deadline: unknown = null;
    const timedOut = new Promise<UploadOutcome>((resolve) => {
      deadline = deps.setTimer(
        () => resolve({ kind: 'retry', status: 0, reason: 'The upload took too long.' }),
        ATTEMPT_TIMEOUT_MS,
      );
    });
    const upload = Promise.resolve()
      .then(() =>
        deps.upload(item, (fraction) => {
          if (settled) return;
          progress[item.id] = fraction;
          emit();
        }),
      )
      .catch((): UploadOutcome => ({ kind: 'retry', status: 0 }));
    return Promise.race([upload, timedOut]).finally(() => {
      settled = true;
      deps.clearTimer(deadline);
    });
  }

  async function runOne(item: QueueItem) {
    running.add(item.id);
    await save({ ...item, state: 'uploading' });
    const outcome = await attempt(item);
    running.delete(item.id);
    delete progress[item.id];
    if (cancelled.has(item.id)) {
      cancelled.delete(item.id);
      // Undone while uploading: the caller deletes the server copy if it landed.
      if (outcome.kind === 'done')
        eventListeners.forEach((l) => l({ type: 'undone-late', photo: outcome.photo }));
      return;
    }
    if (outcome.kind === 'done') {
      items = items.filter((i) => i.id !== item.id);
      await deps.store.delete(item.id);
      emit();
      eventListeners.forEach((l) => l({ type: 'uploaded', item, photo: outcome.photo }));
    } else if (outcome.kind === 'failed') {
      await fail(item, outcome.reason);
    } else if (!deps.isOnline()) {
      // Lost the connection mid-try: wait for it without using up an attempt.
      await save({ ...item, state: 'waiting-offline' });
    } else {
      const attempts = item.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await fail({ ...item, attempts }, retryReason(outcome.status, outcome.reason));
        return;
      }
      await save({
        ...item,
        attempts,
        state: 'queued',
        nextAttemptAt: deps.now() + backoffMs(attempts, deps.random),
      });
    }
  }

  async function fail(item: QueueItem, reason: string) {
    const failed = { ...item, state: 'failed' as const, error: reason };
    await save(failed);
    eventListeners.forEach((l) => l({ type: 'failed', item: failed }));
  }

  async function pump() {
    if (!loaded) return;
    if (!deps.isOnline()) {
      for (const item of items.filter((i) => i.state === 'queued'))
        await save({ ...item, state: 'waiting-offline' });
      return;
    }
    const due = items.filter(
      (i) => i.state === 'queued' && !running.has(i.id) && i.nextAttemptAt <= deps.now(),
    );
    const free = MAX_PARALLEL_UPLOADS - running.size;
    await Promise.all(
      due.slice(0, Math.max(0, free)).map((item) => runOne(item).then(() => pump())),
    );
    schedule();
  }

  return {
    /** Loads queued photos saved before a reload and starts uploading. */
    async start() {
      items = (await deps.store.all()).map((i) =>
        i.state === 'uploading' ? { ...i, state: 'queued' as const } : i,
      );
      loaded = true;
      emit();
      await pump();
    },
    async enqueue(newItems: QueueItem[]) {
      for (const item of newItems) await deps.store.put(item);
      items = [...items, ...newItems];
      emit();
      await pump();
    },
    /** Back online (or tapped "retry"): everything waiting goes again now. */
    async resume() {
      if (!deps.isOnline()) return;
      for (const item of items.filter(
        (i) => i.state === 'waiting-offline' || i.state === 'queued',
      )) {
        await save({ ...item, state: 'queued', nextAttemptAt: deps.now() });
      }
      await pump();
    },
    async retry(id: string) {
      const item = items.find((i) => i.id === id);
      if (item)
        await save({
          ...item,
          state: 'queued',
          attempts: 0,
          nextAttemptAt: deps.now(),
          error: undefined,
        });
      await pump();
    },
    /** Fails photos waiting for a moment that no longer exists (deleted on another phone). */
    async failMissing(isKnown: (frameId: string) => boolean, reason: string) {
      for (const item of items.filter(
        (i) => i.state !== 'failed' && !running.has(i.id) && !isKnown(i.frameId),
      ))
        await fail(item, reason);
      schedule();
    },
    /** Removes a photo that hasn't finished uploading. Returns false if it's mid-upload (the caller deletes it once it lands). */
    async cancel(id: string): Promise<boolean> {
      const uploading = running.has(id);
      if (uploading) cancelled.add(id);
      items = items.filter((i) => i.id !== id);
      await deps.store.delete(id);
      emit();
      return !uploading;
    },
    pending: () => items.some((i) => i.state !== 'failed'),
    getView: (): QueueView => ({ items: [...items], progress: { ...progress } }),
    subscribe(listener: (view: QueueView) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onEvent(listener: (event: QueueEvent) => void) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
  };
}

export type UploadQueue = ReturnType<typeof createUploadQueue>;

export const metaOf = (item: QueueItem): UploadMeta => ({
  id: item.id,
  uploadedBy: item.uploadedBy,
  uploadedAt: item.uploadedAt,
  width: item.width,
  height: item.height,
  thumbWidth: item.thumbWidth,
  thumbHeight: item.thumbHeight,
});

export function memoryQueueStore(): QueueStore {
  const map = new Map<string, QueueItem>();
  return {
    all: async () => [...map.values()],
    put: async (item) => void map.set(item.id, item),
    delete: async (id) => void map.delete(id),
  };
}

const DB_NAME = 'gudauri-album';
const STORE = 'uploads';

/** IndexedDB-backed store (Blobs are stored as-is). Falls back to memory if unavailable. */
export function indexedDbQueueStore(): QueueStore {
  if (typeof indexedDB === 'undefined') return memoryQueueStore();
  const db = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = async <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) => {
    const d = await db;
    return new Promise<T>((resolve, reject) => {
      const req = run(d.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };
  const fallback = memoryQueueStore();
  return {
    all: () => tx<QueueItem[]>('readonly', (s) => s.getAll()).catch(() => fallback.all()),
    put: (item) =>
      tx('readwrite', (s) => s.put(item)).then(
        () => undefined,
        () => fallback.put(item),
      ),
    delete: (id) =>
      tx('readwrite', (s) => s.delete(id)).then(
        () => undefined,
        () => fallback.delete(id),
      ),
  };
}
