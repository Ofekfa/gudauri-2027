import { describe, expect, it } from 'vitest';
import { parseHash } from './hashRouter';

describe('parseHash', () => {
  it.each([
    ['', '/'],
    ['#', '/'],
    ['#/', '/'],
    ['#/flights', '/flights'],
    ['#/flights/', '/flights'],
    ['#/flights?ref=x', '/flights'],
    ['#flights', '/'],
  ])('%s → %s', (hash, expected) => {
    expect(parseHash(hash)).toBe(expected);
  });
});
