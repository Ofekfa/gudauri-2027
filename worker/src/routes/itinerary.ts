import { trip } from '../../../src/data/trip';
import type { ItineraryEvent, ItineraryPayload } from '../../../src/lib/itinerary/types';
import { cacheStoreFor, getOrRefresh, UpstreamUnavailableError } from '../cache';
import { errorJson, json } from '../http';
import { parseItinerary, type DayRange } from '../itinerary/ics';
import {
  ITINERARY_BROWSER_MAX_AGE_S,
  ITINERARY_MAX_STALE_MS,
  ITINERARY_TTL_MS,
  MAX_ICS_BYTES,
  UPSTREAM_TIMEOUT_MS,
} from '../limits';
import type { Route } from '../router';

export const ITINERARY_CACHE_KEY = 'itinerary:v1';
const DAY_MS = 86_400_000;
const TBILISI_OFFSET = '+04:00';

const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The day before arrival through the day after the last day (flight home lands after midnight). */
export const TRIP_RANGE: DayRange = {
  from: shiftDay(trip.firstDay, -1),
  to: shiftDay(trip.lastDay, 1),
};
const WINDOW_START_MS = Date.parse(`${TRIP_RANGE.from}T00:00:00${TBILISI_OFFSET}`);
const WINDOW_END_MS = Date.parse(`${shiftDay(TRIP_RANGE.to, 1)}T00:00:00${TBILISI_OFFSET}`);

class CalendarNotConfiguredError extends Error {}

export async function fetchCalendarEvents(
  url: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<ItineraryEvent[]> {
  if (!url) throw new CalendarNotConfiguredError();
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  // Never include the URL (it's a secret) in errors.
  if (!res.ok) throw new Error(`Calendar responded ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_ICS_BYTES) throw new Error('Calendar feed too large');
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error('Not an iCal feed');
  return parseItinerary(text, TRIP_RANGE, WINDOW_START_MS, WINDOW_END_MS);
}

function validateEvents(raw: unknown): ItineraryEvent[] {
  if (!Array.isArray(raw)) throw new Error('Bad cached itinerary');
  return raw as ItineraryEvent[];
}

export const itineraryRoute: Route = {
  method: 'GET',
  path: '/itinerary',
  rateLimit: 'RL_DATA',
  async handler({ env, cors }) {
    if (!env.CALENDAR_ICS_URL) return errorJson(501, 'Calendar not configured', cors);
    try {
      const result = await getOrRefresh(
        cacheStoreFor(env.CACHE),
        ITINERARY_CACHE_KEY,
        { ttlMs: ITINERARY_TTL_MS, maxStaleMs: ITINERARY_MAX_STALE_MS },
        () => fetchCalendarEvents(env.CALENDAR_ICS_URL),
        validateEvents,
      );
      const payload: ItineraryPayload = {
        timeZone: trip.destinationTimeZone,
        range: TRIP_RANGE,
        events: result.data,
        fetchedAt: new Date(result.fetchedAt).toISOString(),
        stale: result.stale,
      };
      return json(200, payload, {
        ...cors,
        'Cache-Control': `public, max-age=${ITINERARY_BROWSER_MAX_AGE_S}`,
      });
    } catch (err) {
      if (err instanceof UpstreamUnavailableError)
        return errorJson(503, 'Calendar unavailable', cors);
      throw err;
    }
  },
};
