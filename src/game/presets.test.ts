import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, PRESETS } from './constants';
import { presetFromQuery } from './presets';

const q = (s: string) => new URLSearchParams(s);

describe('trial presets from the link', () => {
  it('plays a known preset and labels it', () => {
    expect(presetFromQuery(q('preset=fast'))).toEqual({ profile: PRESETS.fast, label: 'fast' });
    expect(presetFromQuery(q('preset=fastest')).profile).toBe(PRESETS.fastest);
  });

  it('falls back to the default, unlabelled, for anything else', () => {
    for (const s of ['', 'preset=', 'preset=FAST', 'preset=turbo', 'preset=toString', 'x=1'])
      expect(presetFromQuery(q(s)), s).toEqual({ profile: DEFAULT_PROFILE, label: null });
  });

  it('defaults to "faster"', () => {
    expect(DEFAULT_PROFILE).toBe(PRESETS.faster);
  });
});
