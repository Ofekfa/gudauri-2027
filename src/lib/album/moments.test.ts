import { describe, expect, it } from 'vitest';
import { ALBUM_FRAMES } from '../../data/album';
import { zipPlan } from './download';
import { zipName } from './zip';
import { albumProgress, photosByFrame, storySlides, suggestFrame } from './selectors';
import {
  applyMomentOps,
  defaultAfter,
  isOrderKey,
  keyAfter,
  keyBetween,
  mergeMoments,
  predefinedOrderKey,
} from './moments';
import { parseListing, parseMomentInput, type AlbumPhoto, type CustomMoment } from './protocol';

const custom = (id: string, orderKey: string, title = 'Breakfast'): CustomMoment => ({
  id,
  title,
  emoji: '🥐',
  orderKey,
  createdBy: 'maya',
  createdAt: '2027-02-25T08:00:00Z',
  custom: true,
  version: 1,
});

/** Tiny seeded PRNG for repeatable fuzzing. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1_103_515_245 + 12_345) % 2_147_483_648;
    return a / 2_147_483_648;
  };
}

describe('moment order keys', () => {
  it('gives predefined moments increasing keys that leave room in between', () => {
    const keys = ALBUM_FRAMES.map((_, i) => predefinedOrderKey(i));
    expect([...keys].sort()).toEqual(keys);
    expect(keys.every(isOrderKey)).toBe(true);
  });

  it('always finds a key strictly between two others, without running out', () => {
    expect(keyBetween('05', '06')).toBe('05i');
    expect(keyBetween('0m', null) > '0m').toBe(true);
    // 200 inserts into the same gap (halving each time) never collide.
    let low = '05';
    const high = '06';
    for (let i = 0; i < 200; i++) {
      const k = keyBetween(low, high);
      expect(k > low && k < high && isOrderKey(k)).toBe(true);
      low = k;
    }
  });

  it('stays ordered under random inserts and moves', () => {
    const random = seeded(2027);
    let moments: CustomMoment[] = [];
    for (let i = 0; i < 300; i++) {
      const merged = mergeMoments(moments);
      const after = merged[Math.floor(random() * merged.length)]!.id;
      const movable = moments.length > 0 && random() < 0.5;
      if (movable) {
        const target = moments[Math.floor(random() * moments.length)]!;
        if (target.id === after) continue;
        const key = keyAfter(merged, after, target.id)!;
        moments = moments.map((m) => (m.id === target.id ? { ...m, orderKey: key } : m));
        const order = mergeMoments(moments).map((m) => m.id);
        expect(order[order.indexOf(after) + 1]).toBe(target.id);
      } else if (moments.length < 30) {
        const id = `m-${String(i).padStart(10, '0')}`;
        moments = [...moments, custom(id, keyAfter(merged, after)!)];
        const order = mergeMoments(moments).map((m) => m.id);
        expect(order[order.indexOf(after) + 1]).toBe(id);
      }
    }
    const keys = mergeMoments(moments).map((m) => m.orderKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps both moments when two of us add at the same spot at once', () => {
    const merged = mergeMoments([]);
    const key = keyAfter(merged, 'gondola')!;
    const both = mergeMoments([custom('m-bbbbbbbbbb', key), custom('m-aaaaaaaaaa', key)]);
    const ids = both.map((m) => m.id);
    expect(ids.slice(ids.indexOf('gondola') + 1, ids.indexOf('gondola') + 3)).toEqual([
      'm-aaaaaaaaaa',
      'm-bbbbbbbbbb',
    ]);
    // A third one placed after the first of the tied pair goes after both.
    const third = keyAfter(both, 'm-aaaaaaaaaa')!;
    expect(third > key).toBe(true);
  });
});

describe('merged moments', () => {
  it('puts custom moments in place and defaults new ones before the flight home', () => {
    const merged = mergeMoments([]);
    const after = defaultAfter(merged);
    expect(after).toBe('bar');
    const withBreakfast = mergeMoments([custom('m-breakfast', keyAfter(merged, after)!)]);
    const ids = withBreakfast.map((m) => m.id);
    expect(ids.slice(ids.indexOf('bar'), ids.indexOf('bar') + 3)).toEqual([
      'bar',
      'm-breakfast',
      'flight-home',
    ]);
    expect(withBreakfast.find((m) => m.id === 'm-breakfast')).toMatchObject({ custom: true });
  });

  it('returns null for an unknown place', () => {
    expect(keyAfter(mergeMoments([]), 'nowhere')).toBeNull();
  });
});

describe('moment input', () => {
  it('validates and cleans a new moment', () => {
    expect(
      parseMomentInput({ title: '  Break\u0000fast  ', emoji: '🥐', after: 'bar' }, false),
    ).toEqual({ ok: true, value: { title: 'Break fast', emoji: '🥐', after: 'bar' } });
    expect(parseMomentInput({ title: '', emoji: '🥐', after: 'bar' }, false).ok).toBe(false);
    expect(parseMomentInput({ title: 'x'.repeat(41), emoji: '🥐', after: 'bar' }, false).ok).toBe(
      false,
    );
    expect(parseMomentInput({ title: 'Ok', emoji: '💩', after: 'bar' }, false).ok).toBe(false);
    expect(
      parseMomentInput({ title: 'Ok', emoji: '🥐', after: 'bar', prompt: 'p'.repeat(81) }, false)
        .ok,
    ).toBe(false);
    expect(parseMomentInput({}, true).ok).toBe(false);
    expect(parseMomentInput({ prompt: '' }, true)).toEqual({ ok: true, value: { prompt: '' } });
  });
});

describe('album listing with moments', () => {
  const photo = (id: string, frameId: string) => ({
    id,
    frameId,
    uploadedBy: 'ofek',
    uploadedAt: '2027-02-25T10:00:00Z',
    width: 2048,
    height: 1536,
    thumbWidth: 480,
    thumbHeight: 360,
    version: 1,
  });

  it('accepts an older reply without moments', () => {
    expect(parseListing({ frames: {}, photos: [] })).toEqual({
      frames: {},
      photos: [],
      moments: [],
    });
  });

  it('keeps photos of existing custom moments and drops those of deleted ones', () => {
    const listing = parseListing({
      frames: {
        'm-breakfast1': { version: 1, coverPhotoId: 'photo-0001' },
        'm-deleted001': { version: 1 },
      },
      photos: [photo('photo-0001', 'm-breakfast1'), photo('photo-0002', 'm-deleted001')],
      moments: [custom('m-breakfast1', '0r'), { id: 'm-bad', title: 'x' }],
    });
    expect(listing.moments.map((m) => m.id)).toEqual(['m-breakfast1']);
    expect(listing.photos.map((p) => p.id)).toEqual(['photo-0001']);
    expect(Object.keys(listing.frames)).toEqual(['m-breakfast1']);
  });
});

describe('custom moments across the album', () => {
  const photo = (id: string, frameId: string): AlbumPhoto => ({
    id,
    frameId,
    uploadedBy: 'ofek',
    uploadedAt: '2027-02-25T10:00:00Z',
    width: 2048,
    height: 1536,
    thumbWidth: 480,
    thumbHeight: 360,
    version: 1,
  });
  const breakfast = custom('m-breakfast1', keyAfter(mergeMoments([]), 'bar')!);
  const moments = mergeMoments([breakfast]);

  it('counts our own moments in the progress, never as bonus', () => {
    const byFrame = photosByFrame([photo('photo-0001', 'm-breakfast1')], moments);
    expect(albumProgress(byFrame, moments)).toEqual({
      captured: 1,
      total: albumProgress(photosByFrame([])).total + 1,
      bonus: 0,
    });
  });

  it('tells the story and numbers the download in the merged order', () => {
    const photos = [photo('photo-0001', 'm-breakfast1'), photo('photo-0002', 'flight-home')];
    expect(
      storySlides(photos, moments)
        .filter((s) => s.kind === 'title')
        .map((s) => s.frame.id),
    ).toEqual(['m-breakfast1', 'flight-home']);
    const n = moments.findIndex((m) => m.id === 'm-breakfast1') + 1;
    const flightHome = moments[n]!;
    expect(flightHome.id).toBe('flight-home');
    expect(zipPlan(photos, moments).map((e) => e.name)).toEqual([
      zipName(n, 'Breakfast', 1),
      zipName(n + 1, flightHome.title, 1),
    ]);
  });

  it('suggests an empty custom moment in Quick add like any other', () => {
    const only = mergeMoments([custom('m-breakfast1', '00i')]);
    expect(only[0]!.id).toBe('m-breakfast1');
    const morning = Date.parse('2027-02-25T07:00:00Z');
    expect(suggestFrame(morning, photosByFrame([], only), only)).toBe('m-breakfast1');
  });
});

describe('optimistic moment changes', () => {
  it('shows a new moment, an edit and a delete before the server confirms', () => {
    const server = [custom('m-aaaaaaaaaa', '0r', 'Sauna'), custom('m-bbbbbbbbbb', '0s', 'Tea')];
    const shown = applyMomentOps(server, [
      { kind: 'create', moment: custom('tmp-1', '0t', 'Breakfast') },
      { kind: 'edit', id: 'm-aaaaaaaaaa', changes: { title: 'Steam room', prompt: '' } },
      { kind: 'delete', id: 'm-bbbbbbbbbb' },
    ]);
    expect(shown.map((m) => [m.id, m.title])).toEqual([
      ['m-aaaaaaaaaa', 'Steam room'],
      ['tmp-1', 'Breakfast'],
    ]);
    expect('prompt' in shown[0]!).toBe(false);
    expect(server[0]!.title).toBe('Sauna');
  });
});
