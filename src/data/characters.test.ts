import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
import { trip } from './trip';

describe('characters', () => {
  it('defines a look for every traveler', () => {
    for (const { id } of trip.travelers) expect(CHARACTERS[id]).toBeDefined();
  });

  it('gives each traveler a distinct signature color', () => {
    const colors = Object.values(CHARACTERS).map((c) => c.jacket);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
