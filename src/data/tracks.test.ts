import { describe, expect, it } from 'vitest';
import { ALLOWED_LICENSES, TRACKS } from './tracks';

const MIN_TRACKS = 40;
const MIN_TOTAL_S = 2.5 * 3600;
const MIN_MODERN_SHARE = 0.2;
const HOSTS = /^https:\/\/(upload\.wikimedia\.org|archive\.org)\//;

describe('background music library', () => {
  it('is big and varied enough not to feel repetitive', () => {
    const total = TRACKS.reduce((sum, t) => sum + t.durationS, 0);
    const modern = TRACKS.filter((t) => t.era === 'modern').length / TRACKS.length;
    expect(TRACKS.length).toBeGreaterThanOrEqual(MIN_TRACKS);
    expect(total).toBeGreaterThanOrEqual(MIN_TOTAL_S);
    expect(modern).toBeGreaterThanOrEqual(MIN_MODERN_SHARE);
    expect(modern).toBeLessThanOrEqual(1 - MIN_MODERN_SHARE);
    expect(new Set(TRACKS.map((t) => t.artist)).size).toBeGreaterThanOrEqual(8);
  });

  it('has unique ids', () => {
    const ids = TRACKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TRACKS.map((t) => [t.id, t] as const))(
    '%s is licensed, credited and streamable',
    (_id, t) => {
      expect(ALLOWED_LICENSES).toContain(t.license);
      expect(t.src).toMatch(HOSTS);
      expect(t.src).toMatch(/\.mp3$/);
      expect(t.sourceUrl).toMatch(/^https:\/\//);
      if (t.license !== 'PD' && t.license !== 'CC0') expect(t.licenseUrl).toMatch(/^https:\/\//);
      expect(t.attribution.length).toBeGreaterThan(10);
      expect(t.title.trim()).not.toBe('');
      expect(t.durationS).toBeGreaterThan(0);
      expect(t.gainDb).toBeLessThanOrEqual(0);
      expect(t.gainDb).toBeGreaterThanOrEqual(-18);
      // After the offset, every track sits within a few dB of the others.
      expect(t.loudnessLufs + t.gainDb).toBeLessThanOrEqual(-21.9);
      expect(t.loudnessLufs + t.gainDb).toBeGreaterThanOrEqual(-28);
      expect(t.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );
});
