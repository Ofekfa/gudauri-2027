import { localDateIn } from '../lib/time/countdown';
import { zonedTimeToIso } from '../lib/time/format';
import { END_OF_DAY, TODO_TIME_ZONE } from '../lib/todo/due';
import type { NewTodo } from '../lib/todo/reducer';
import type { Trip } from './trip';

/**
 * Pre-flight starter lists. Deadlines are derived from the flights in trip.ts,
 * so changing a flight time moves them too.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Online check-in should be done well before the airport counters close. */
const CHECK_IN_LEAD_MS = 3 * HOUR_MS;

export const MISSING_GEAR_KEY = 'missing-gear';

/** An exact deadline, e.g. 3 h before a departure. */
const before = (iso: string, ms: number) => new Date(Date.parse(iso) - ms).toISOString();

/** End of the day (Israel time) `days` calendar days before `iso`. */
const daysBefore = (iso: string, days: number) =>
  zonedTimeToIso(
    localDateIn(Date.parse(iso) - days * DAY_MS, TODO_TIME_ZONE),
    END_OF_DAY,
    TODO_TIME_ZONE,
  );

const CHECK_IN_NOTE =
  'Online check-in usually opens about 24 hours before departure; confirm the exact window in the El Al app.';

/** Items for each traveler's own list. */
export function personalTemplate(trip: Trip): NewTodo[] {
  const takeoff = trip.outbound.departure;
  return [
    {
      title: 'Check your passport is valid for the trip',
      category: 'documents',
      note: 'Also check Georgia’s current entry rules for Israeli passport holders.',
      dueBy: daysBefore(takeoff, 30),
    },
    {
      title: 'Buy travel insurance with winter-sports cover',
      category: 'documents',
      note: 'Make sure skiing/snowboarding is explicitly covered, including rescue.',
      dueBy: daysBefore(takeoff, 14),
    },
    {
      title: 'Order missing gear',
      category: 'gear',
      note: 'Everything marked “need to buy” on your packing list.',
      dueBy: daysBefore(takeoff, 10),
      templateKey: MISSING_GEAR_KEY,
    },
    {
      title: 'Get an eSIM or roaming package for Georgia',
      category: 'connectivity',
      dueBy: daysBefore(takeoff, 3),
    },
    {
      title: 'Get some Georgian lari (GEL) in cash',
      category: 'documents',
      note: 'Handy for taxis, small cafés and tips.',
      dueBy: daysBefore(takeoff, 1),
    },
    {
      title: `Online check-in for ${trip.outbound.flightNo} (outbound)`,
      category: 'flight',
      note: CHECK_IN_NOTE,
      dueBy: before(takeoff, CHECK_IN_LEAD_MS),
    },
    {
      title: `Online check-in for ${trip.inbound.flightNo} (return)`,
      category: 'flight',
      note: CHECK_IN_NOTE,
      dueBy: before(trip.inbound.departure, CHECK_IN_LEAD_MS),
    },
  ];
}

/** Group tasks: whoever takes one ticks it off on the Shared list. */
export function sharedTemplate(trip: Trip): NewTodo[] {
  const takeoff = trip.outbound.departure;
  return [
    {
      title: 'Research and book ski instructors',
      category: 'ski',
      note: 'Worth booking early for beginners; lessons fill up in high season.',
      dueBy: daysBefore(takeoff, 10),
    },
    {
      title: `Book the transfer from ${trip.outbound.to.city} airport to ${trip.resort}`,
      category: 'flight',
      note: 'We land at 09:50 local time; the drive is roughly 2–2.5 hours.',
      dueBy: daysBefore(takeoff, 7),
    },
    {
      title: 'Book ski/snowboard rental',
      category: 'ski',
      dueBy: daysBefore(takeoff, 7),
    },
  ];
}
