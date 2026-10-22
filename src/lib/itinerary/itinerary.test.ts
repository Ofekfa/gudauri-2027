import { describe, expect, it, vi } from 'vitest';
import { trip } from '../../data/trip';
import { createMemoryStore } from '../storage/safeStorage';
import {
  fetchItinerary,
  ItineraryNotConfiguredError,
  loadCachedItinerary,
  saveCachedItinerary,
} from './itineraryClient';
import { dayLabel, flightEntries, groupByDay, itineraryDays, mergeEntries, nowNext } from './plan';
import { validateItineraryPayload, type ItineraryEvent } from './types';

const TZ = 'Asia/Tbilisi';
const calendar: ItineraryEvent[] = [
  {
    id: 'a',
    title: 'Ski lesson',
    start: '2027-02-25T08:00:00.000Z',
    end: '2027-02-25T10:00:00.000Z',
    allDay: false,
  },
  // 21:30 UTC on the 25th is 01:30 on the 26th in Tbilisi.
  {
    id: 'b',
    title: 'Late snooker',
    start: '2027-02-25T21:30:00.000Z',
    end: '2027-02-25T22:30:00.000Z',
    allDay: false,
  },
  { id: 'c', title: 'Night skiing option', start: '2027-02-26', end: '2027-02-28', allDay: true },
];

describe('itinerary planning', () => {
  it('covers the day before arrival through the day after the last day', () => {
    expect(itineraryDays(trip)).toEqual([
      '2027-02-23',
      '2027-02-24',
      '2027-02-25',
      '2027-02-26',
      '2027-02-27',
      '2027-02-28',
      '2027-03-01',
    ]);
  });

  it('merges both flights from trip.ts as fixed entries', () => {
    const flights = flightEntries(trip, calendar);
    expect(flights.map((f) => [f.id, f.start])).toEqual([
      ['flight-outbound', '2027-02-24T03:15:00.000Z'],
      ['flight-inbound', '2027-02-28T19:55:00.000Z'],
    ]);
  });

  it('skips a flight the calendar already names (any spacing)', () => {
    const withFlight = [
      ...calendar,
      {
        id: 'f',
        title: 'Flight',
        location: 'El Al LY 5107',
        start: '2027-02-24T05:15:00.000Z',
        end: '2027-02-24T07:50:00.000Z',
        allDay: false,
      },
    ];
    expect(flightEntries(trip, withFlight).map((f) => f.id)).toEqual(['flight-inbound']);
  });

  it('groups by Tbilisi day, spreading multi-day all-day events', () => {
    const groups = groupByDay(mergeEntries(trip, calendar), itineraryDays(trip), TZ);
    expect(groups.get('2027-02-25')!.map((e) => e.id)).toEqual(['a']);
    expect(groups.get('2027-02-26')!.map((e) => e.id)).toEqual(['c', 'b']);
    expect(groups.get('2027-02-27')!.map((e) => e.id)).toEqual(['c']);
    expect(groups.get('2027-02-24')!.map((e) => e.id)).toEqual(['flight-outbound']);
  });

  it('finds what is on now and next', () => {
    const entries = mergeEntries(trip, calendar);
    expect(nowNext(entries, Date.parse('2027-02-25T09:00:00Z'))).toMatchObject({
      now: [{ id: 'a' }],
      next: { id: 'b' },
    });
    expect(nowNext(entries, Date.parse('2027-03-02T00:00:00Z'))).toEqual({ now: [], next: null });
  });

  it('labels days', () => {
    expect(dayLabel('2027-02-23', trip)).toEqual({ kind: 'before' });
    expect(dayLabel('2027-02-26', trip)).toEqual({ kind: 'trip', dayNumber: 3 });
    expect(dayLabel('2027-03-01', trip)).toEqual({ kind: 'after' });
  });
});

describe('itinerary client', () => {
  const payload = {
    timeZone: TZ,
    range: { from: '2027-02-23', to: '2027-03-01' },
    events: calendar,
    fetchedAt: '2026-10-22T05:00:00.000Z',
    stale: false,
  };

  it('validates payloads and drops malformed events', () => {
    const v = validateItineraryPayload({
      ...payload,
      events: [...calendar, { id: 'x', title: 1 }],
    });
    expect(v.events).toHaveLength(3);
    expect(() => validateItineraryPayload({ ...payload, range: {} })).toThrow();
  });

  it('distinguishes "not configured" (501) from other failures', async () => {
    const r501 = vi.fn().mockResolvedValue(new Response('{}', { status: 501 }));
    await expect(fetchItinerary('https://w', r501)).rejects.toBeInstanceOf(
      ItineraryNotConfiguredError,
    );
    const r503 = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(fetchItinerary('https://w', r503)).rejects.not.toBeInstanceOf(
      ItineraryNotConfiguredError,
    );
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
    await expect(fetchItinerary('https://w', ok)).resolves.toEqual(payload);
  });

  it('keeps the last itinerary for offline use', () => {
    const store = createMemoryStore();
    expect(loadCachedItinerary(store)).toBeNull();
    saveCachedItinerary(payload, store);
    expect(loadCachedItinerary(store)).toEqual(payload);
  });
});
