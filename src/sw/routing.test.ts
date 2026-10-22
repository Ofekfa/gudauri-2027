import { describe, expect, it } from 'vitest';
import { SKIP_WAITING_MESSAGE } from '../lib/pwa/register';
import { cacheNameFor, classify, SKIP_WAITING, staleCaches } from './routing';

const SCOPE = 'https://ofekfa.github.io/gudauri-2027/';
const PRECACHED = new Set(['index.html', 'assets/index-abc.js', 'fonts/fredoka-latin.woff2']);
const req = (url: string, init: { method?: string; mode?: string } = {}) => ({
  url,
  method: init.method ?? 'GET',
  mode: init.mode ?? 'cors',
});

describe('service worker routing', () => {
  it('answers navigations inside the scope with the app shell', () => {
    for (const url of [SCOPE, `${SCOPE}?utm=x`, `${SCOPE}index.html`]) {
      expect(classify(req(url, { mode: 'navigate' }), SCOPE, PRECACHED)).toBe('shell');
    }
  });

  it('serves precached files from the cache', () => {
    expect(classify(req(`${SCOPE}assets/index-abc.js`), SCOPE, PRECACHED)).toBe('precache');
    expect(classify(req(`${SCOPE}fonts/fredoka-latin.woff2`), SCOPE, PRECACHED)).toBe('precache');
  });

  it('never touches the Worker (chat or data), other sites, non-GET or unknown files', () => {
    const worker = 'https://gudauri-2027-assistant.gudauri-2027-assistant.workers.dev';
    expect(classify(req(`${worker}/chat`, { method: 'POST' }), SCOPE, PRECACHED)).toBe('network');
    expect(classify(req(`${worker}/weather`), SCOPE, PRECACHED)).toBe('network');
    expect(classify(req('https://www.youtube-nocookie.com/embed/x'), SCOPE, PRECACHED)).toBe(
      'network',
    );
    expect(
      classify(req('https://ofekfa.github.io/other-repo/', { mode: 'navigate' }), SCOPE, PRECACHED),
    ).toBe('network');
    expect(classify(req(`${SCOPE}og-image.png`), SCOPE, PRECACHED)).toBe('network');
    expect(classify(req(`${SCOPE}og-image.png`, { mode: 'navigate' }), SCOPE, PRECACHED)).toBe(
      'network',
    );
  });

  it('cleans up only our own older caches', () => {
    const current = cacheNameFor('new');
    expect(staleCaches([cacheNameFor('old'), current, 'someone-else'], current)).toEqual([
      cacheNameFor('old'),
    ]);
  });

  it('agrees with the page on the update message', () => {
    expect(SKIP_WAITING_MESSAGE).toBe(SKIP_WAITING);
  });
});
