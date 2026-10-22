/**
 * Itinerary payload served by the Worker's /itinerary route (from our Google
 * Calendar). Only whitelisted fields ever leave the Worker.
 */

export interface ItineraryEvent {
  /** Stable, opaque id (hash of the calendar UID + start). */
  id: string;
  title: string;
  /** Timed events: UTC ISO instant. All-day events: YYYY-MM-DD. */
  start: string;
  /** Exclusive end (for all-day events, the day after the last day). */
  end: string;
  allDay: boolean;
  location?: string;
}

export interface ItineraryPayload {
  timeZone: string;
  /** Inclusive calendar range covered (YYYY-MM-DD). */
  range: { from: string; to: string };
  events: ItineraryEvent[];
  fetchedAt: string;
  stale: boolean;
}

export const MAX_TITLE_CHARS = 120;
export const MAX_LOCATION_CHARS = 120;
export const MAX_EVENTS = 200;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function validEvent(raw: unknown): ItineraryEvent | null {
  if (!isRecord(raw)) return null;
  const { id, title, start, end, allDay, location } = raw;
  if (typeof id !== 'string' || typeof title !== 'string' || typeof allDay !== 'boolean')
    return null;
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const ok = allDay
    ? DAY.test(start) && DAY.test(end)
    : !Number.isNaN(Date.parse(start)) && !Number.isNaN(Date.parse(end));
  if (!ok) return null;
  return {
    id,
    title: title.slice(0, MAX_TITLE_CHARS),
    start,
    end,
    allDay,
    ...(typeof location === 'string' && location
      ? { location: location.slice(0, MAX_LOCATION_CHARS) }
      : {}),
  };
}

/** Validates the Worker payload (or a cached copy); invalid events are dropped. */
export function validateItineraryPayload(raw: unknown): ItineraryPayload {
  if (!isRecord(raw) || !Array.isArray(raw.events) || !isRecord(raw.range)) {
    throw new Error('Bad itinerary payload');
  }
  const { from, to } = raw.range;
  if (typeof from !== 'string' || typeof to !== 'string' || !DAY.test(from) || !DAY.test(to)) {
    throw new Error('Bad itinerary range');
  }
  if (typeof raw.timeZone !== 'string' || typeof raw.fetchedAt !== 'string') {
    throw new Error('Bad itinerary metadata');
  }
  return {
    timeZone: raw.timeZone,
    range: { from, to },
    events: raw.events
      .map(validEvent)
      .filter((e): e is ItineraryEvent => e !== null)
      .slice(0, MAX_EVENTS),
    fetchedAt: raw.fetchedAt,
    stale: raw.stale === true,
  };
}
