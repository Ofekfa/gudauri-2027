import { describe, expect, it } from 'vitest';
import { detectSwipe, keyToDirection, SWIPE_MIN_DISTANCE_PX, wrapIndex } from './carousel';

describe('wrapIndex', () => {
  it('wraps in both directions', () => {
    expect(wrapIndex(0, 5)).toBe(0);
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(12, 5)).toBe(2);
    expect(wrapIndex(3, 0)).toBe(0);
  });
});

describe('detectSwipe', () => {
  it('maps a left swipe to next and a right swipe to previous', () => {
    expect(detectSwipe(-80, 5)).toBe('next');
    expect(detectSwipe(80, -5)).toBe('previous');
  });

  it('ignores short or mostly vertical gestures', () => {
    expect(detectSwipe(-(SWIPE_MIN_DISTANCE_PX - 1), 0)).toBeNull();
    expect(detectSwipe(-80, 70)).toBeNull();
  });
});

describe('keyToDirection', () => {
  it('maps arrow keys only', () => {
    expect(keyToDirection('ArrowRight')).toBe('next');
    expect(keyToDirection('ArrowLeft')).toBe('previous');
    expect(keyToDirection('Enter')).toBeNull();
  });
});
