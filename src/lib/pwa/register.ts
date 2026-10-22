/**
 * Registers the service worker (production only) and offers updates: a new
 * version waits until the user taps "Refresh", so a page never swaps code
 * under someone mid-task.
 */

/** Must match SKIP_WAITING in src/sw/routing.ts (kept separate so the worker stays self-contained). */
export const SKIP_WAITING_MESSAGE = 'SKIP_WAITING';

export function registerServiceWorker(onUpdateReady: (apply: () => void) => void): void {
  if (!('serviceWorker' in navigator)) return;
  const container = navigator.serviceWorker;
  let applying = false;
  // Reload only after the user asked for the update, not when the first install takes control.
  container.addEventListener('controllerchange', () => {
    if (applying) window.location.reload();
  });

  const offer = (registration: ServiceWorkerRegistration) => {
    const waiting = registration.waiting;
    if (!waiting || !container.controller) return;
    onUpdateReady(() => {
      applying = true;
      waiting.postMessage({ type: SKIP_WAITING_MESSAGE });
    });
  };

  window.addEventListener('load', () => {
    container
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        offer(registration);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed') offer(registration);
          });
        });
        // Phones keep the app open for days: look for a new version when it comes back.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        });
      })
      .catch(() => {
        /* Offline support is a bonus; the site works without it. */
      });
  });
}
