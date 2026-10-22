/// <reference lib="webworker" />
/**
 * Service worker: precaches the whole site at install so every page works
 * offline after one visit. Built by build/serviceWorkerPlugin.ts, which fills
 * in the precache list and version.
 */
import {
  cacheNameFor,
  classify,
  IMAGE_CACHE,
  MAX_CACHED_IMAGES,
  SHELL,
  SKIP_WAITING,
  staleCaches,
} from './routing';

declare let self: ServiceWorkerGlobalScope;

const MANIFEST: string[] = JSON.parse('__PRECACHE_MANIFEST__');
const CACHE = cacheNameFor('__SW_VERSION__');
const PRECACHED = new Set(MANIFEST);
const scoped = (path: string) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  // Bypass the HTTP cache so a deploy never precaches a stale index.html.
  const requests = MANIFEST.map((path) => new Request(scoped(path), { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(requests)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(staleCaches(names, CACHE).map((name) => caches.delete(name)));
      // Control the open page right away, so the first visit already works offline.
      await self.clients.claim();
    })(),
  );
});

// A new version waits until the page asks it to take over (the "Refresh" toast).
self.addEventListener('message', (event) => {
  if ((event.data as { type?: unknown } | null)?.type === SKIP_WAITING) void self.skipWaiting();
});

/** Cache-first for dish photos; a miss is fetched, stored and the cache trimmed. */
async function cachedImage(request: Request): Promise<Response> {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    await Promise.all(
      keys.slice(0, Math.max(0, keys.length - MAX_CACHED_IMAGES)).map((k) => cache.delete(k)),
    );
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const kind = classify(event.request, self.registration.scope, PRECACHED);
  if (kind === 'network') return;
  if (kind === 'image') {
    event.respondWith(cachedImage(event.request));
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key = kind === 'shell' ? scoped(SHELL) : event.request;
      return (await cache.match(key, { ignoreSearch: true })) ?? fetch(event.request);
    })(),
  );
});
