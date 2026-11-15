import { describe, expect, it } from 'vitest';
import { YOUTUBE_ID_PATTERN } from '../lib/weather/webcam';
import { ZONES } from './zones';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

describe('zones', () => {
  it('has unique ids and the three zones', () => {
    expect(ZONES.map((z) => z.id).sort()).toEqual(['base', 'mid', 'top']);
  });

  it('gives every zone either a webcam or a note explaining why not', () => {
    for (const zone of ZONES) expect(Boolean(zone.webcam) || Boolean(zone.webcamNote)).toBe(true);
  });

  it('has valid webcam data for every provider', () => {
    for (const { webcam } of ZONES) {
      if (!webcam) continue;
      expect(webcam.provider).toBe('youtube');
      expect(webcam.id).toMatch(YOUTUBE_ID_PATTERN);
      expect(webcam.label.trim()).not.toBe('');
      expect(webcam.checkedOn).toMatch(ISO_DAY);
      expect(Number.isNaN(Date.parse(webcam.checkedOn))).toBe(false);
    }
  });

  it('uses distinct streams for each zone', () => {
    const ids = ZONES.flatMap((z) => (z.webcam ? [z.webcam.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('shows the Kudebi stream at the top', () => {
    const top = ZONES.find((z) => z.id === 'top');
    expect(top?.webcam?.label).toMatch(/Kudebi/);
  });
});
