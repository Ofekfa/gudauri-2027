/**
 * Pure request routing for the service worker (unit-tested). Only GET requests
 * inside the site's own scope are ever answered from the cache; everything
 * else (the Worker's /chat and data routes, YouTube, OpenStreetMap links)
 * goes straight to the network.
 */
export type RouteKind = 'shell' | 'precache' | 'image' | 'network';

export interface RequestLike {
  method: string;
  url: string;
  mode: string;
}

/** The app shell every navigation is answered with (routing is hash-based). */
export const SHELL = 'index.html';
export const CACHE_PREFIX = 'gudauri-precache-';
/** Dish photos are cached as they're viewed (too many to precache); kept across versions. */
export const IMAGE_CACHE = 'gudauri-images';
export const IMAGE_PREFIX = 'food/';
/** Oldest entries are dropped beyond this (≈ every dish at both sizes, one format). */
export const MAX_CACHED_IMAGES = 120;
/** Message a waiting worker accepts to take over (mirrored in lib/pwa/register.ts). */
export const SKIP_WAITING = 'SKIP_WAITING';

const FILE_EXTENSION = /\.[a-z0-9]+$/i;

export function classify(
  req: RequestLike,
  scope: string,
  precached: ReadonlySet<string>,
): RouteKind {
  if (req.method !== 'GET') return 'network';
  const url = new URL(req.url);
  const base = new URL(scope);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return 'network';
  const path = url.pathname.slice(base.pathname.length);
  if (req.mode === 'navigate') {
    // A direct link to a file (e.g. the share image) isn't a page.
    return FILE_EXTENSION.test(path) && !path.endsWith('.html') ? 'network' : 'shell';
  }
  if (precached.has(path)) return 'precache';
  return path.startsWith(IMAGE_PREFIX) ? 'image' : 'network';
}

export const cacheNameFor = (version: string) => `${CACHE_PREFIX}${version}`;

/** Our older precaches (other apps' caches on the origin are left alone). */
export const staleCaches = (names: readonly string[], current: string) =>
  names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== current);
