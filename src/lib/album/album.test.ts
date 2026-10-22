import { crc32 as nodeCrc32 } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALBUM_FRAMES } from '../../data/album';
import { encodeWithin, fitWithin, FULL_EDGE } from './pipeline';
import type { AlbumPhoto } from './protocol';
import {
  backoffMs,
  createUploadQueue,
  memoryQueueStore,
  type QueueEvent,
  type QueueItem,
} from './queue';
import type { UploadOutcome } from './repository';
import { albumProgress, coverFor, photosByFrame, suggestFrame, viewerIndex } from './selectors';
import { crc32, createZip, zipName } from './zip';

const photo = (id: string, frameId: string, uploadedAt: string): AlbumPhoto => ({
  id,
  frameId,
  uploadedBy: 'ofek',
  uploadedAt,
  width: 2048,
  height: 1536,
  thumbWidth: 480,
  thumbHeight: 360,
  version: 1,
});

describe('album selectors', () => {
  const photos = [
    photo('photo-c', 'snowman', '2027-02-25T12:00:00Z'),
    photo('photo-a', 'snowman', '2027-02-25T10:00:00Z'),
    photo('photo-b', 'dinner-2027-02-24', '2027-02-24T19:00:00Z'),
    photo('photo-x', 'nowhere', '2027-02-24T19:00:00Z'),
  ];
  const byFrame = photosByFrame(photos);

  it('groups by frame, oldest first, ignoring unknown frames', () => {
    expect(byFrame.get('snowman')!.map((p) => p.id)).toEqual(['photo-a', 'photo-c']);
    expect(byFrame.size).toBe(ALBUM_FRAMES.length);
  });

  it('uses the chosen cover if it exists, else the first photo', () => {
    const snow = byFrame.get('snowman')!;
    expect(coverFor(snow, { version: 1, coverPhotoId: 'photo-c' })?.id).toBe('photo-c');
    expect(coverFor(snow, { version: 1, coverPhotoId: 'deleted-1' })?.id).toBe('photo-a');
    expect(coverFor([], undefined)).toBeUndefined();
  });

  it('counts planned moments and bonus frames separately', () => {
    expect(albumProgress(byFrame)).toEqual({ captured: 2, total: 19, bonus: 0 });
  });

  it('suggests tonight’s dinner in the evening, else the first empty moment', () => {
    expect(suggestFrame(Date.parse('2027-02-25T15:30:00Z'), byFrame)).toBe('dinner-2027-02-25'); // 19:30 Tbilisi
    expect(suggestFrame(Date.parse('2027-02-25T08:00:00Z'), byFrame)).toBe('mcdonalds'); // morning
    const all = photosByFrame(
      ALBUM_FRAMES.map((f, i) => photo(`photo-${i}0000`, f.id, '2027-02-25T08:00:00Z')),
    );
    expect(suggestFrame(Date.parse('2027-02-25T08:00:00Z'), all)).toBe('the-four-of-us');
    expect(suggestFrame(Date.parse('2027-03-05T18:00:00Z'), byFrame)).toBe('mcdonalds'); // after the trip
  });

  it('finds the viewer index, defaulting to the first photo', () => {
    const snow = byFrame.get('snowman')!;
    expect(viewerIndex(snow, 'photo-c')).toBe(1);
    expect(viewerIndex(snow, 'missing')).toBe(0);
    expect(viewerIndex(snow, undefined)).toBe(0);
  });
});

describe('image pipeline maths', () => {
  it('fits within the long edge without upscaling', () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(5000, 10, 480)).toEqual({ width: 480, height: 1 });
  });

  it('steps quality down, then size, until it fits', async () => {
    const tried: string[] = [];
    const encode = async (edge: number, quality: number) => {
      tried.push(`${edge}@${quality}`);
      return { blob: new Blob([new Uint8Array(edge * 1000 * quality)]), edge };
    };
    const result = await encodeWithin(encode, 1_300_000);
    expect(result.edge).toBe(FULL_EDGE);
    expect(tried).toEqual(['2048@0.82', '2048@0.72', '2048@0.62']);
    const tight = await encodeWithin(encode, 800_000);
    expect(tight.edge).toBe(1280);
  });
});

describe('zip writer', () => {
  it('writes a valid stored archive with correct CRCs and names', async () => {
    const files = [
      { name: zipName(1, 'McDonald’s before the flight', 1), data: new Uint8Array([1, 2, 3]) },
      {
        name: zipName(12, 'Dinner — Wed 24 Feb', 3),
        data: new TextEncoder().encode('hello album'),
      },
    ];
    expect(files.map((f) => f.name)).toEqual([
      '01-mcdonalds-before-the-flight-01.jpg',
      '12-dinner-wed-24-feb-03.jpg',
    ]);
    for (const f of files) expect(crc32(f.data)).toBe(nodeCrc32(f.data));
    const bytes = new Uint8Array(await createZip(files).arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const dir = view.getUint32(end + 16, true);
    expect(view.getUint32(dir, true)).toBe(0x02014b50);
    expect(view.getUint32(dir + 16, true)).toBe(crc32(files[0]!.data));
    const second = 30 + files[0]!.name.length + 3;
    expect(
      new TextDecoder().decode(bytes.subarray(second + 30, second + 30 + files[1]!.name.length)),
    ).toBe(files[1]!.name);
  });
});

describe('upload queue', () => {
  beforeEach(() => vi.useFakeTimers({ now: Date.parse('2027-02-25T10:00:00Z') }));
  afterEach(() => vi.useRealTimers());

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

  function setup(
    outcomes: (id: string) => UploadOutcome | Promise<UploadOutcome>,
    online = { value: true },
  ) {
    const store = memoryQueueStore();
    const calls: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const queue = createUploadQueue({
      store,
      upload: async (it) => {
        calls.push(it.id);
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        const out = await outcomes(it.id);
        inFlight--;
        return out;
      },
      isOnline: () => online.value,
      now: () => Date.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      random: () => 0.5,
    });
    const events: QueueEvent[] = [];
    queue.onEvent((e) => events.push(e));
    return { store, queue, calls, events, maxInFlight: () => maxInFlight, online };
  }
  const done = (id: string): UploadOutcome => ({
    kind: 'done',
    photo: photo(id, 'snowman', '2027-02-25T10:00:00Z'),
  });

  it('backs off exponentially, capped', () => {
    expect([1, 2, 3, 10].map((a) => backoffMs(a, () => 0.5))).toEqual([2000, 4000, 8000, 300000]);
  });

  it('uploads a multi-select batch two at a time and empties the store', async () => {
    const q = setup(done);
    await q.queue.start();
    await q.queue.enqueue(['photo-1', 'photo-2', 'photo-3', 'photo-4', 'photo-5'].map(item));
    await vi.runAllTimersAsync();
    expect(q.calls.sort()).toEqual(['photo-1', 'photo-2', 'photo-3', 'photo-4', 'photo-5']);
    expect(q.maxInFlight()).toBe(2);
    expect(await q.store.all()).toEqual([]);
    expect(q.events.filter((e) => e.type === 'uploaded')).toHaveLength(5);
  });

  it('retries with backoff, then succeeds', async () => {
    let tries = 0;
    const q = setup(() => (++tries < 3 ? { kind: 'retry', status: 503 } : done('photo-1')));
    await q.queue.start();
    await q.queue.enqueue([item('photo-1')]);
    expect(q.queue.getView().items[0]!.attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(tries).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(tries).toBe(2);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(tries).toBe(3);
    expect(q.queue.getView().items).toEqual([]);
  });

  it('waits offline, survives a reload, and resumes when back online', async () => {
    const online = { value: false };
    const first = setup(done, online);
    await first.queue.start();
    await first.queue.enqueue([item('photo-1')]);
    expect(first.queue.getView().items[0]!.state).toBe('waiting-offline');
    expect(first.calls).toEqual([]);
    // "Reload": a new engine on the same store.
    const second = createUploadQueue({
      store: first.store,
      upload: async (it) => done(it.id),
      isOnline: () => online.value,
      now: () => Date.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    });
    await second.start();
    expect(second.getView().items).toHaveLength(1);
    online.value = true;
    await second.resume();
    await vi.runAllTimersAsync();
    expect(second.getView().items).toEqual([]);
  });

  it('marks definite failures and lets them be retried', async () => {
    let fail = true;
    const q = setup((id) =>
      fail ? { kind: 'failed', status: 409, reason: 'This frame is full (30 photos).' } : done(id),
    );
    await q.queue.start();
    await q.queue.enqueue([item('photo-1')]);
    expect(q.queue.getView().items[0]).toMatchObject({
      state: 'failed',
      error: 'This frame is full (30 photos).',
    });
    expect(q.queue.pending()).toBe(false);
    fail = false;
    await q.queue.retry('photo-1');
    await vi.runAllTimersAsync();
    expect(q.queue.getView().items).toEqual([]);
  });

  it('undo removes a queued photo, and reports one that landed mid-upload', async () => {
    let release: (o: UploadOutcome) => void = () => {};
    const q = setup((id) =>
      id === 'photo-slow' ? new Promise((r) => (release = r)) : { kind: 'retry', status: 503 },
    );
    await q.queue.start();
    await q.queue.enqueue([item('photo-waiting')]);
    expect(await q.queue.cancel('photo-waiting')).toBe(true);
    expect(await q.store.all()).toEqual([]);
    const enqueued = q.queue.enqueue([item('photo-slow')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(await q.queue.cancel('photo-slow')).toBe(false);
    release(done('photo-slow'));
    await enqueued;
    expect(q.events).toContainEqual({
      type: 'undone-late',
      photo: expect.objectContaining({ id: 'photo-slow' }),
    });
    expect(q.queue.getView().items).toEqual([]);
  });
});
