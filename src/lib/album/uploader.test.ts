import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlbumPhoto } from './protocol';
import { createUploadQueue, MAX_ATTEMPTS, memoryQueueStore, type QueueItem } from './queue';
import type { UploadOutcome } from './repository';
import type { TokenResult } from './token';
import { createUploader, TOKEN_FAILURE } from './uploader';

const NOW = Date.parse('2027-02-25T10:00:00Z');
const HOUR = 3_600_000;

const item = (id: string): QueueItem => ({
  id,
  frameId: 'snowman',
  uploadedBy: 'maya',
  uploadedAt: '2027-02-25T10:00:00Z',
  full: new Blob(['f']),
  thumb: new Blob(['t']),
  width: 2048,
  height: 1536,
  thumbWidth: 480,
  thumbHeight: 360,
  attempts: 0,
  nextAttemptAt: 0,
  state: 'queued',
});

const photo = (id: string): AlbumPhoto => ({
  id,
  frameId: 'snowman',
  uploadedBy: 'maya',
  uploadedAt: '2027-02-25T10:00:00Z',
  width: 2048,
  height: 1536,
  thumbWidth: 480,
  thumbHeight: 360,
  version: 1,
});

function setup(
  token: () => TokenResult,
  upload: () => UploadOutcome = () => ({ kind: 'done', photo: photo('photo-1') }),
) {
  const getToken = vi.fn(async () => token());
  const clearToken = vi.fn();
  const repoUpload = vi.fn(async () => upload());
  const queue = createUploadQueue({
    store: memoryQueueStore(),
    upload: createUploader({ getToken, clearToken, repo: { upload: repoUpload } }),
    isOnline: () => true,
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    random: () => 0.5,
  });
  return { queue, getToken, clearToken, repoUpload };
}

describe('album uploader', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  // The live bug: the Worker answered POST /album/session with 501 and the
  // photo sat at "Uploading 0%" forever, retrying silently, never sent.
  it('fails visibly when the album isn’t set up, instead of retrying forever', async () => {
    const t = setup(() => ({ error: 'not-set-up' }));
    await t.queue.start();
    await t.queue.enqueue([item('photo-1')]);
    await vi.advanceTimersByTimeAsync(HOUR);
    const [it1] = t.queue.getView().items;
    expect(it1).toMatchObject({ state: 'failed', error: expect.stringMatching(/set up/) });
    expect(t.getToken).toHaveBeenCalledTimes(1);
    expect(t.repoUpload).not.toHaveBeenCalled();
    expect(t.queue.pending()).toBe(false);
  });

  it('fails at once for a wrong group code or a phone that hasn’t joined', async () => {
    for (const error of ['wrong-code', 'not-joined'] as const) {
      const t = setup(() => ({ error }));
      await t.queue.start();
      await t.queue.enqueue([item('photo-1')]);
      expect(t.queue.getView().items[0]).toMatchObject({
        state: 'failed',
        error: TOKEN_FAILURE[error],
      });
    }
  });

  it('retries when the token can’t be fetched, then gives up with a reason', async () => {
    const t = setup(() => ({ error: 'offline' }));
    await t.queue.start();
    await t.queue.enqueue([item('photo-1')]);
    expect(t.queue.getView().items[0]).toMatchObject({ state: 'queued', attempts: 1 });
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(t.getToken).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(t.queue.getView().items[0]).toMatchObject({
      state: 'failed',
      error: 'Couldn’t reach the server.',
    });
  });

  it('drops a rejected token so the next try gets a fresh one, then uploads', async () => {
    let tries = 0;
    const t = setup(
      () => ({ token: `t${tries}` }),
      () =>
        ++tries === 1 ? { kind: 'retry', status: 401 } : { kind: 'done', photo: photo('photo-1') },
    );
    await t.queue.start();
    await t.queue.enqueue([item('photo-1')]);
    expect(t.clearToken).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    expect(t.repoUpload).toHaveBeenCalledTimes(2);
    expect(t.queue.getView().items).toEqual([]);
  });
});
