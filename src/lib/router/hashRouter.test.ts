import { describe, expect, it } from 'vitest';
import { href, parseHash, parseHashQuery } from './hashRouter';

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

describe('hash query', () => {
  it('reads parameters after the route', () => {
    const q = parseHashQuery('#/packing?who=maya&status=need-to-buy');
    expect([q.get('who'), q.get('status')]).toEqual(['maya', 'need-to-buy']);
    expect(parseHashQuery('#/packing').get('who')).toBeNull();
  });

  it('builds links with and without parameters', () => {
    expect(href('/flights')).toBe('#/flights');
    expect(href('/packing', { who: 'roy', status: 'need-to-buy' })).toBe(
      '#/packing?who=roy&status=need-to-buy',
    );
    expect(parseHash(href('/packing', { who: 'roy' }))).toBe('/packing');
  });
});
