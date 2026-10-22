import { appStore, type KeyValueStore } from '../storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';
import { WORKER_URL } from '../worker/config';
import { validateItineraryPayload, type ItineraryPayload } from './types';

const REQUEST_TIMEOUT_MS = 10_000;
const STORE_VERSION = 1;

export class ItineraryNotConfiguredError extends Error {}

export async function fetchItinerary(
  url: string | null = WORKER_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<ItineraryPayload> {
  if (!url) throw new ItineraryNotConfiguredError('Worker URL not configured');
  const res = await fetchImpl(`${url}/itinerary`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 501) throw new ItineraryNotConfiguredError('Calendar not configured');
  if (!res.ok) throw new Error(`Itinerary request failed: ${res.status}`);
  return validateItineraryPayload(await res.json());
}

interface Stored {
  version: typeof STORE_VERSION;
  payload: ItineraryPayload | null;
}

const spec: VersionedSpec<Stored> = {
  key: 'itinerary:last',
  version: STORE_VERSION,
  validate: (raw) => {
    try {
      return { version: STORE_VERSION, payload: validateItineraryPayload((raw as Stored).payload) };
    } catch {
      return null;
    }
  },
  empty: () => ({ version: STORE_VERSION, payload: null }),
};

/** Last itinerary seen on this device (shown instantly and when offline). */
export const loadCachedItinerary = (store: KeyValueStore = appStore) =>
  loadVersioned(store, spec).value.payload;

export function saveCachedItinerary(
  payload: ItineraryPayload,
  store: KeyValueStore = appStore,
): void {
  saveVersioned(store, spec, { version: STORE_VERSION, payload });
}
