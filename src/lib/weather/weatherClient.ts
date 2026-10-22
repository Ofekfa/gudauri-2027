import { appStore, type KeyValueStore } from '../storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';
import { WORKER_URL } from '../worker/config';
import type { WeatherPayload } from './types';
import { validateWeatherPayload } from './validate';

const REQUEST_TIMEOUT_MS = 10_000;
const STORE_VERSION = 1;

export async function fetchWeather(
  url: string | null = WORKER_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<WeatherPayload> {
  if (!url) throw new Error('Worker URL not configured');
  const res = await fetchImpl(`${url}/weather`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  return validateWeatherPayload(await res.json());
}

interface Stored {
  version: typeof STORE_VERSION;
  payload: WeatherPayload | null;
}

const spec: VersionedSpec<Stored> = {
  key: 'weather:last',
  version: STORE_VERSION,
  validate: (raw) => {
    try {
      return { version: STORE_VERSION, payload: validateWeatherPayload((raw as Stored).payload) };
    } catch {
      return null;
    }
  },
  empty: () => ({ version: STORE_VERSION, payload: null }),
};

export const loadCachedWeather = (store: KeyValueStore = appStore) =>
  loadVersioned(store, spec).value.payload;

export function saveCachedWeather(payload: WeatherPayload, store: KeyValueStore = appStore): void {
  saveVersioned(store, spec, { version: STORE_VERSION, payload });
}
