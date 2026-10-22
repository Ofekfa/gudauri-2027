import { describe, expect, it } from 'vitest';
import { ALBUM_FRAMES, dinnerFrames, findFrame, PLANNED_FRAMES } from './album';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('album frames', () => {
  it('has unique slug ids, 19 planned frames and 3 bonus frames at the end', () => {
    const ids = ALBUM_FRAMES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SLUG);
    expect(PLANNED_FRAMES).toHaveLength(19);
    expect(ALBUM_FRAMES.slice(-3).every((f) => f.bonus)).toBe(true);
    expect(findFrame('snowman')?.title).toBe('Snowman');
  });

  it('keeps the story order', () => {
    const ids = ALBUM_FRAMES.map((f) => f.id);
    const order = [
      'mcdonalds',
      'flight-out',
      'taxi',
      'first-snow',
      'snowman',
      'snowball-fight',
      'skiing',
      'gondola',
      'dinner-2027-02-24',
      'dinner-2027-02-28',
      'lunch-beer',
      'bowling',
      'snooker',
      'pool',
      'bar',
      'flight-home',
    ];
    const positions = order.map((id) => ids.indexOf(id));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('derives one dinner per evening of the trip', () => {
    const dinners = dinnerFrames('2027-02-24', '2027-02-28');
    expect(dinners.map((d) => d.title)).toEqual([
      'Dinner — Wed 24 Feb',
      'Dinner — Thu 25 Feb',
      'Dinner — Fri 26 Feb',
      'Dinner — Sat 27 Feb',
      'Dinner — Sun 28 Feb',
    ]);
    expect(dinners.every((d) => d.dateHint === d.id.slice('dinner-'.length))).toBe(true);
  });

  it('has text for every frame and no brand logos', () => {
    for (const f of ALBUM_FRAMES) {
      expect(f.title.trim()).not.toBe('');
      expect(f.prompt.trim()).not.toBe('');
      expect(f.emoji).not.toMatch(/[A-Za-z]/);
    }
    expect(ALBUM_FRAMES.find((f) => f.id === 'mcdonalds')?.emoji).toBe('🍟');
  });
});
