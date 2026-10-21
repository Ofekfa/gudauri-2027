import { describe, expect, it } from 'vitest';
import { findVoice } from './voices';

const voices = [
  { lang: 'en-US', name: 'Samantha', localService: true },
  { lang: 'kk-KZ', name: 'Kazakh' },
  { lang: 'ka-GE', name: 'Online Georgian', localService: false },
  { lang: 'ka_GE', name: 'Local Georgian', localService: true },
];

describe('findVoice', () => {
  it('finds a Georgian voice, preferring local ones', () => {
    expect(findVoice(voices, 'ka')?.name).toBe('Local Georgian');
  });

  it('does not confuse similar prefixes', () => {
    expect(findVoice([voices[1]!], 'ka')).toBeNull();
  });

  it('returns null when no voice exists, so the UI can hide the button', () => {
    expect(findVoice([voices[0]!], 'ka')).toBeNull();
    expect(findVoice([], 'ka')).toBeNull();
  });
});
