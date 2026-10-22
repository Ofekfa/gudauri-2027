import { describe, expect, it } from 'vitest';
import { trackVolume } from './player';

describe('music volume', () => {
  it('combines the user volume, the track offset and ducking, within [0, 1]', () => {
    expect(trackVolume(0.6, 0, 1)).toBeCloseTo(0.6);
    expect(trackVolume(1, -6, 1)).toBeCloseTo(0.501, 2);
    expect(trackVolume(1, 0, 0.2)).toBeCloseTo(0.2);
    expect(trackVolume(2, 0, 1)).toBe(1);
    expect(trackVolume(-1, 0, 1)).toBe(0);
  });
});
