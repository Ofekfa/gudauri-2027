import { describe, expect, it } from 'vitest';
import { matchRoute, parseHash } from '../router/hashRouter';
import { indicator, photoHref, startIndex, step } from './cardCarousel';
import type { AlbumPhoto } from './protocol';

const photo = (id: string): AlbumPhoto => ({
  id,
  frameId: 'snowball-fight',
  uploadedBy: 'ofek',
  uploadedAt: '2027-02-25T10:00:00Z',
  width: 2048,
  height: 1536,
  thumbWidth: 480,
  thumbHeight: 360,
  version: 1,
});
const photos = ['photo-a', 'photo-b', 'photo-c'].map(photo);

describe('card carousel', () => {
  it('starts at the cover, or the first photo if there is none', () => {
    expect(startIndex(photos, 'photo-b')).toBe(1);
    expect(startIndex(photos, undefined)).toBe(0);
    expect(startIndex(photos, 'deleted-cover')).toBe(0);
  });

  it('steps both ways and wraps around', () => {
    expect(step(0, 'next', 3)).toBe(1);
    expect(step(2, 'next', 3)).toBe(0);
    expect(step(0, 'previous', 3)).toBe(2);
  });

  it('shows dots up to five photos, then a counter', () => {
    expect(indicator(1, 5)).toEqual({ kind: 'dots', count: 5, active: 1 });
    expect(indicator(1, 6)).toEqual({ kind: 'counter', text: '2 / 6' });
  });

  it('links the shown photo to the moment page at that photo', () => {
    const link = photoHref('snowball-fight', 'photo-b');
    expect(link).toBe('#/album/snowball-fight/photo-b');
    // Resolves the way app.tsx routes it: the frame page with [frame, photo].
    const route = matchRoute(parseHash(link), {}, { '/album': 'frame-page' }, { '/album': 2 });
    expect(route).toMatchObject({ page: 'frame-page', params: ['snowball-fight', 'photo-b'] });
  });
});
