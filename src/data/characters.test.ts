import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
import { trip } from './trip';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((c, i) => c - rgb(b)[i]!));

/** Hair must read as hair at 32 px: clearly apart from the face and from each other. */
const MIN_HAIR_SKIN_CONTRAST = 1.6;
const MIN_HAIR_DISTANCE = 40;

describe('characters', () => {
  it('defines a look for every traveler', () => {
    for (const { id } of trip.travelers) expect(CHARACTERS[id]).toBeDefined();
  });

  it('gives each traveler a distinct signature color', () => {
    const colors = Object.values(CHARACTERS).map((c) => c.jacket);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('keeps every hair color distinct, readable against the face, and shaded darker', () => {
    const looks = Object.entries(CHARACTERS);
    for (const [id, look] of looks) {
      expect(contrast(look.hair, look.skin), `${id} hair vs skin`).toBeGreaterThanOrEqual(
        MIN_HAIR_SKIN_CONTRAST,
      );
      expect(luminance(look.hairShade), `${id} shade`).toBeLessThan(luminance(look.hair));
    }
    for (let i = 0; i < looks.length; i++) {
      for (let j = i + 1; j < looks.length; j++) {
        const [a, la] = looks[i]!;
        const [b, lb] = looks[j]!;
        expect(distance(la.hair, lb.hair), `${a} vs ${b} hair`).toBeGreaterThanOrEqual(
          MIN_HAIR_DISTANCE,
        );
      }
    }
  });

  it('describes the hair as it is drawn', () => {
    expect(CHARACTERS.ofek.description).toMatch(/light-brown hair/);
    expect(CHARACTERS.ron.description).toMatch(/brown hair/);
    expect(CHARACTERS.roy.description).toMatch(/black hair/);
    expect(CHARACTERS.maya.description).toMatch(/ginger hair/);
  });
});
