import { describe, expect, it } from 'vitest';
import { basePath, href, matchRoute, parseHash, parseHashQuery } from './hashRouter';

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

describe('detail routes', () => {
  const exact = { '/': 'home', '/food': 'food', '/flights': 'flights' };
  const withParam = { '/food': 'dish' };

  it('finds the section of a detail path', () => {
    expect(basePath('/food/khinkali')).toBe('/food');
    expect(basePath('/food')).toBe('/food');
    expect(basePath('/')).toBe('/');
    expect(basePath('/album/snowman/p1')).toBe('/album');
    expect(basePath('/a/b/c/d')).toBe('/a/b/c/d');
  });

  it('prefers exact routes, then one-segment detail routes', () => {
    expect(matchRoute('/food', exact, withParam)).toEqual({ page: 'food', base: '/food' });
    expect(matchRoute(parseHash('#/food/khinkali/'), exact, withParam)).toEqual({
      page: 'dish',
      base: '/food',
      params: ['khinkali'],
      param: 'khinkali',
    });
    expect(matchRoute(parseHash('#/food/khinkali?from=list'), exact, withParam)?.param).toBe(
      'khinkali',
    );
  });

  it('decodes the segment and rejects unknown sections, deeper paths and bad encoding', () => {
    expect(matchRoute('/food/%E1%83%AE', exact, withParam)?.param).toBe('ხ');
    expect(matchRoute('/flights/ly5107', exact, withParam)).toBeNull();
    expect(matchRoute('/food/a/b', exact, withParam)).toBeNull();
    expect(matchRoute('/food/%E0%A4%A', exact, withParam)).toBeNull();
    expect(matchRoute('/nope', exact, withParam)).toBeNull();
  });
});

describe('two-segment detail routes', () => {
  const exact = { '/album': 'grid', '/album/story': 'story' };
  const withParam = { '/album': 'frame', '/food': 'dish' };
  const max = { '/album': 2 };

  it('passes up to the allowed number of segments, decoded', () => {
    expect(matchRoute('/album/snowman', exact, withParam, max)?.params).toEqual(['snowman']);
    expect(matchRoute('/album/snowman/p%201', exact, withParam, max)?.params).toEqual([
      'snowman',
      'p 1',
    ]);
    expect(matchRoute('/album/a/b/c', exact, withParam, max)).toBeNull();
    // Food still takes one segment.
    expect(matchRoute('/food/a/b', exact, withParam, max)).toBeNull();
  });

  it('lets an exact route win over a detail route', () => {
    expect(matchRoute('/album/story', exact, withParam, max)?.page).toBe('story');
  });
});
