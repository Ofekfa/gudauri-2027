import { appStore, type KeyValueStore } from '../storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';
import { WORKER_URL } from '../worker/config';
import { validateRatesPayload, type RatesPayload } from './rates';

const REQUEST_TIMEOUT_MS = 10_000;
const RATES_STORE_VERSION = 1;

export async function fetchRates(
  url: string | null = WORKER_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<RatesPayload> {
  if (!url) throw new Error('Worker URL not configured');
  const res = await fetchImpl(`${url}/rates`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Rates request failed: ${res.status}`);
  return validateRatesPayload(await res.json());
}

interface StoredRates {
  version: typeof RATES_STORE_VERSION;
  payload: RatesPayload | null;
}

const spec: VersionedSpec<StoredRates> = {
  key: 'currency:rates',
  version: RATES_STORE_VERSION,
  validate: (raw) => {
    const payload = (raw as { payload?: unknown }).payload;
    try {
      return { version: RATES_STORE_VERSION, payload: validateRatesPayload(payload) };
    } catch {
      return null;
    }
  },
  empty: () => ({ version: RATES_STORE_VERSION, payload: null }),
};

/** Last rates seen on this device, for offline use. */
export function loadCachedRates(store: KeyValueStore = appStore): RatesPayload | null {
  return loadVersioned(store, spec).value.payload;
}

export function saveCachedRates(payload: RatesPayload, store: KeyValueStore = appStore): void {
  saveVersioned(store, spec, { version: RATES_STORE_VERSION, payload });
}
