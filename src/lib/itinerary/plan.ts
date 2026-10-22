import type { Trip } from '../../data/trip';
import { TBC } from '../../data/trip';
import { daysBetween, localDateIn } from '../time/countdown';
import type { ItineraryEvent } from './types';

export type EntryKind = 'event' | 'flight';

export interface ItineraryEntry extends ItineraryEvent {
  kind: EntryKind;
}

/** Calendar days shown (YYYY-MM-DD): the day before arrival through the day after the last day. */
export function itineraryDays(trip: Trip): string[] {
  const first = shift(trip.firstDay, -1);
  const last = shift(trip.lastDay, 1);
  const days: string[] = [];
  for (let d = first; d <= last; d = shift(d, 1)) days.push(d);
  return days;
}

const DAY_MS = 86_400_000;
function shift(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

const flightKey = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/**
 * Our two flights from trip.ts as fixed entries, unless the calendar already
 * has an event naming the same flight number (to avoid duplicates).
 */
export function flightEntries(trip: Trip, calendar: ItineraryEvent[]): ItineraryEntry[] {
  const mentioned = (flightNo: string) =>
    calendar.some((e) => flightKey(`${e.title} ${e.location ?? ''}`).includes(flightKey(flightNo)));
  return [
    { leg: trip.outbound, id: 'flight-outbound' },
    { leg: trip.inbound, id: 'flight-inbound' },
  ]
    .filter(({ leg }) => !mentioned(leg.flightNo))
    .map(({ leg, id }) => ({
      id,
      kind: 'flight' as const,
      title: `${leg.carrier} ${leg.flightNo}: ${leg.from.city} → ${leg.to.city}`,
      start: new Date(Date.parse(leg.departure)).toISOString(),
      end: new Date(Date.parse(leg.arrival === TBC ? leg.departure : leg.arrival)).toISOString(),
      allDay: false,
      location: `${leg.from.iata} → ${leg.to.iata}`,
    }));
}

/** Calendar events plus flights, sorted by start (all-day first within a day). */
export function mergeEntries(trip: Trip, calendar: ItineraryEvent[]): ItineraryEntry[] {
  const events: ItineraryEntry[] = calendar.map((e) => ({ ...e, kind: 'event' }));
  return [...events, ...flightEntries(trip, calendar)].sort((a, b) => sortKey(a) - sortKey(b));
}

const sortKey = (e: ItineraryEntry) =>
  e.allDay ? Date.parse(`${e.start}T00:00:00Z`) - 1 : Date.parse(e.start);

/** Calendar day(s) an entry belongs to, in `timeZone`. Multi-day all-day events span each day. */
export function entryDays(entry: ItineraryEntry, timeZone: string): string[] {
  if (entry.allDay) {
    const days: string[] = [];
    for (let d = entry.start; d < entry.end; d = shift(d, 1)) days.push(d);
    return days.length ? days : [entry.start];
  }
  return [localDateIn(Date.parse(entry.start), timeZone)];
}

export function groupByDay(
  entries: ItineraryEntry[],
  days: string[],
  timeZone: string,
): Map<string, ItineraryEntry[]> {
  const map = new Map(days.map((d) => [d, [] as ItineraryEntry[]]));
  for (const entry of entries) {
    for (const day of entryDays(entry, timeZone)) map.get(day)?.push(entry);
  }
  // Within a day: all-day entries first, then by start time.
  for (const list of map.values()) {
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || sortKey(a) - sortKey(b));
  }
  return map;
}

/** Timed entries happening now, and the next one to start (all-day entries excluded). */
export function nowNext(
  entries: ItineraryEntry[],
  nowMs: number,
): { now: ItineraryEntry[]; next: ItineraryEntry | null } {
  const timed = entries.filter((e) => !e.allDay);
  return {
    now: timed.filter((e) => Date.parse(e.start) <= nowMs && nowMs < Date.parse(e.end)),
    next: timed.find((e) => Date.parse(e.start) > nowMs) ?? null,
  };
}

/** "Day 2 of 5" style label for a calendar day, or "Before"/"After" outside the trip. */
export function dayLabel(
  day: string,
  trip: Trip,
): { kind: 'before' | 'trip' | 'after'; dayNumber?: number } {
  if (day < trip.firstDay) return { kind: 'before' };
  if (day > trip.lastDay) return { kind: 'after' };
  return { kind: 'trip', dayNumber: daysBetween(trip.firstDay, day) + 1 };
}
