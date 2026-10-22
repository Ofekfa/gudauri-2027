import {
  parseErApiResponse,
  parseNbgResponse,
  validateRates,
  type Rates,
  type RatesPayload,
} from '../../../src/lib/currency/rates';
import { cacheStoreFor, getOrRefresh, UpstreamUnavailableError, type CachedResult } from '../cache';
import type { Env } from '../env';
import { errorJson, json } from '../http';
import { RATES_BROWSER_MAX_AGE_S, RATES_MAX_STALE_MS, RATES_TTL_MS } from '../limits';
import type { Route } from '../router';
import { fetchJson } from '../upstream/fetchJson';

/** Official National Bank of Georgia rates (unfiltered: the filter accepts one code only). */
export const NBG_URL = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';
/** Fallback with GEL coverage; requires attribution to ExchangeRate-API. */
export const ER_API_URL = 'https://open.er-api.com/v6/latest/GEL';
export const RATES_CACHE_KEY = 'rates:v1';

/** NBG first, ExchangeRate-API if NBG is down or returns something unusable. */
export async function fetchRates(fetchImpl: typeof fetch = fetch): Promise<Rates> {
  try {
    return parseNbgResponse(await fetchJson(NBG_URL, fetchImpl));
  } catch {
    return parseErApiResponse(await fetchJson(ER_API_URL, fetchImpl));
  }
}

/** Cached rates (shared by /rates and the assistant's live context). */
export function loadRates(env: Env): Promise<CachedResult<Rates>> {
  return getOrRefresh(
    cacheStoreFor(env.CACHE),
    RATES_CACHE_KEY,
    { ttlMs: RATES_TTL_MS, maxStaleMs: RATES_MAX_STALE_MS },
    () => fetchRates(),
    validateRates,
  );
}

export const ratesRoute: Route = {
  method: 'GET',
  path: '/rates',
  rateLimit: 'RL_DATA',
  async handler({ env, cors }) {
    try {
      const result = await loadRates(env);
      const payload: RatesPayload = {
        base: 'GEL',
        ...result.data,
        fetchedAt: new Date(result.fetchedAt).toISOString(),
        stale: result.stale,
      };
      return json(200, payload, {
        ...cors,
        'Cache-Control': `public, max-age=${RATES_BROWSER_MAX_AGE_S}`,
      });
    } catch (err) {
      if (err instanceof UpstreamUnavailableError) return errorJson(503, 'Rates unavailable', cors);
      throw err;
    }
  },
};
