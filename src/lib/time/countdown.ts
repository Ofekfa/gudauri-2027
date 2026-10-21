import { TBC, type Trip } from '../../data/trip';

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export type TripPhase =
  | { kind: 'before'; remainingMs: number }
  | { kind: 'during'; day: number; totalDays: number }
  | { kind: 'after' };

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function splitDuration(ms: number): DurationParts {
  const clamped = Math.max(0, ms);
  return {
    days: Math.floor(clamped / MS_PER_DAY),
    hours: Math.floor((clamped % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((clamped % MS_PER_HOUR) / MS_PER_MINUTE),
    seconds: Math.floor((clamped % MS_PER_MINUTE) / MS_PER_SECOND),
  };
}

/** Calendar date (YYYY-MM-DD) of an instant in the given IANA zone. */
export function localDateIn(instantMs: number, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instantMs);
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

export function tripTotalDays(trip: Trip): number {
  return daysBetween(trip.firstDay, trip.lastDay) + 1;
}

/** The trip is over once we land home (or, if that's unknown, once the return flight departs). */
function tripEndMs(trip: Trip): number {
  const { arrival, departure } = trip.inbound;
  return Date.parse(arrival === TBC ? departure : arrival);
}

export function getTripPhase(nowMs: number, trip: Trip): TripPhase {
  const startMs = Date.parse(trip.outbound.departure);
  if (nowMs < startMs) return { kind: 'before', remainingMs: startMs - nowMs };
  if (nowMs >= tripEndMs(trip)) return { kind: 'after' };

  const totalDays = tripTotalDays(trip);
  const offset = daysBetween(trip.firstDay, localDateIn(nowMs, trip.destinationTimeZone));
  // Clamp: the late-night flight home lands after midnight but still belongs to the last day.
  const day = Math.min(totalDays, Math.max(1, offset + 1));
  return { kind: 'during', day, totalDays };
}
