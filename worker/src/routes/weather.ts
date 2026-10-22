import { ZONES } from '../../../src/data/zones';
import { forecastUrl, summarizeZone, validateOpenMeteo } from '../../../src/lib/weather/openMeteo';
import type { WeatherPayload, ZoneWeather } from '../../../src/lib/weather/types';
import { cacheStoreFor, getOrRefresh, UpstreamUnavailableError, type CachedResult } from '../cache';
import type { Env } from '../env';
import { errorJson, json } from '../http';
import { WEATHER_BROWSER_MAX_AGE_S, WEATHER_MAX_STALE_MS, WEATHER_TTL_MS } from '../limits';
import type { Route } from '../router';
import { fetchJson } from '../upstream/fetchJson';

export const WEATHER_CACHE_KEY = 'weather:v1';

/** One Open-Meteo call for all zones (each downscaled to its elevation), summarized per zone. */
export async function fetchZoneWeather(fetchImpl: typeof fetch = fetch): Promise<ZoneWeather[]> {
  const locations = validateOpenMeteo(await fetchJson(forecastUrl(ZONES), fetchImpl), ZONES.length);
  return ZONES.map((zone, i) => summarizeZone(zone, locations[i]!));
}

function validateCached(raw: unknown): ZoneWeather[] {
  if (!Array.isArray(raw) || raw.length !== ZONES.length) throw new Error('Bad cached weather');
  return raw as ZoneWeather[];
}

/** Cached per-zone weather (shared by /weather and the assistant's live context). */
export function loadWeather(env: Env): Promise<CachedResult<ZoneWeather[]>> {
  return getOrRefresh(
    cacheStoreFor(env.CACHE),
    WEATHER_CACHE_KEY,
    { ttlMs: WEATHER_TTL_MS, maxStaleMs: WEATHER_MAX_STALE_MS },
    () => fetchZoneWeather(),
    validateCached,
  );
}

export const weatherRoute: Route = {
  method: 'GET',
  path: '/weather',
  rateLimit: 'RL_DATA',
  async handler({ env, cors }) {
    try {
      const result = await loadWeather(env);
      const payload: WeatherPayload = {
        source: 'open-meteo',
        fetchedAt: new Date(result.fetchedAt).toISOString(),
        stale: result.stale,
        zones: result.data,
      };
      return json(200, payload, {
        ...cors,
        'Cache-Control': `public, max-age=${WEATHER_BROWSER_MAX_AGE_S}`,
      });
    } catch (err) {
      if (err instanceof UpstreamUnavailableError)
        return errorJson(503, 'Weather unavailable', cors);
      throw err;
    }
  },
};
