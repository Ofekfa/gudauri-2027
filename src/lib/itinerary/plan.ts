import type { FlightLeg, Trip } from '../../data/trip';
import { TBC } from '../../data/trip';
import { daysBetween, localDateIn } from '../time/countdown';
import type { ItineraryEvent } from './types';

export type EntryKind = 'event' | 'flight';

export type LegId = 'outbound' | 'inbound';

export interface ItineraryEntry extends ItineraryEvent {
  kind: EntryKind;
  /** Set when the entry is one of our flights (ours, or a calendar event naming the flight). */
  leg?: LegId;
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

const legs = (trip: Trip): { id: LegId; leg: FlightLeg }[] => [
  { id: 'outbound', leg: trip.outbound },
  { id: 'inbound', leg: trip.inbound },
];

/** Which of our flights a calendar event names ("LY 5107" counts), if any. */
export function legOf(event: ItineraryEvent, trip: Trip): LegId | undefined {
  const text = flightKey(`${event.title} ${event.location ?? ''}`);
  return legs(trip).find(({ leg }) => text.includes(flightKey(leg.flightNo)))?.id;
}

/**
 * Our two flights from trip.ts as fixed entries, unless the calendar already
 * has an event naming the same flight number (to avoid duplicates).
 */
export function flightEntries(trip: Trip, calendar: ItineraryEvent[]): ItineraryEntry[] {
  const mentioned = new Set(calendar.map((e) => legOf(e, trip)));
  return legs(trip)
    .filter(({ id }) => !mentioned.has(id))
    .map(({ leg, id: legId }) => ({
      id: `flight-${legId}`,
      kind: 'flight' as const,
      leg: legId,
      title: `${leg.carrier} ${leg.flightNo}: ${leg.from.city} → ${leg.to.city}`,
      start: new Date(Date.parse(leg.departure)).toISOString(),
      end: new Date(Date.parse(leg.arrival === TBC ? leg.departure : leg.arrival)).toISOString(),
      allDay: false,
      location: `${leg.from.iata} → ${leg.to.iata}`,
    }));
}

/** Calendar events plus flights, sorted by start (all-day first within a day). */
export function mergeEntries(trip: Trip, calendar: ItineraryEvent[]): ItineraryEntry[] {
  const events: ItineraryEntry[] = calendar.map((e) => {
    const leg = legOf(e, trip);
    return leg ? { ...e, kind: 'flight', leg } : { ...e, kind: 'event' };
  });
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

/** Before we land in Georgia we read times in Israel; from landing on, in Georgia. */
export function displayZone(entry: ItineraryEvent, trip: Trip): string {
  const landing = trip.outbound.arrival === TBC ? trip.outbound.departure : trip.outbound.arrival;
  if (!entry.allDay && Date.parse(entry.start) < Date.parse(landing))
    return trip.outbound.from.timeZone;
  return trip.destinationTimeZone;
}

/** Departure and arrival, each in its own airport's time, from the booking (trip.ts). */
export function flightTimes(
  legId: LegId,
  trip: Trip,
): { from: string; depart: string; to: string; arrive: string | null; nextDay: boolean } {
  const leg = legId === 'outbound' ? trip.outbound : trip.inbound;
  const local = (iso: string, timeZone: string) => ({
    time: new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(Date.parse(iso)),
    date: localDateIn(Date.parse(iso), timeZone),
  });
  const dep = local(leg.departure, leg.from.timeZone);
  const arr = leg.arrival === TBC ? null : local(leg.arrival, leg.to.timeZone);
  return {
    from: leg.from.iata,
    depart: dep.time,
    to: leg.to.iata,
    arrive: arr?.time ?? null,
    nextDay: arr !== null && arr.date > dep.date,
  };
}

export function groupByDay(
  entries: ItineraryEntry[],
  days: string[],
  /** One zone for everything, or a zone per entry (see displayZone). */
  timeZone: string | ((entry: ItineraryEntry) => string),
): Map<string, ItineraryEntry[]> {
  const zoneOf = typeof timeZone === 'string' ? () => timeZone : timeZone;
  const map = new Map(days.map((d) => [d, [] as ItineraryEntry[]]));
  for (const entry of entries) {
    for (const day of entryDays(entry, zoneOf(entry))) map.get(day)?.push(entry);
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
