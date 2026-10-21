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

const before = (iso: string, ms: number) => new Date(Date.parse(iso) - ms).toISOString();

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
      dueBy: before(takeoff, 30 * DAY_MS),
    },
    {
      title: 'Buy travel insurance with winter-sports cover',
      category: 'documents',
      note: 'Make sure skiing/snowboarding is explicitly covered, including rescue.',
      dueBy: before(takeoff, 14 * DAY_MS),
    },
    {
      title: 'Order missing gear',
      category: 'gear',
      note: 'Everything marked “need to buy” on your packing list.',
      dueBy: before(takeoff, 10 * DAY_MS),
      templateKey: MISSING_GEAR_KEY,
    },
    {
      title: 'Get an eSIM or roaming package for Georgia',
      category: 'connectivity',
      dueBy: before(takeoff, 3 * DAY_MS),
    },
    {
      title: 'Get some Georgian lari (GEL) in cash',
      category: 'documents',
      note: 'Handy for taxis, small cafés and tips.',
      dueBy: before(takeoff, 1 * DAY_MS),
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
      dueBy: before(takeoff, 10 * DAY_MS),
    },
    {
      title: `Book the transfer from ${trip.outbound.to.city} airport to ${trip.resort}`,
      category: 'flight',
      note: 'We land at 09:50 local time; the drive is roughly 2–2.5 hours.',
      dueBy: before(takeoff, 7 * DAY_MS),
    },
    {
      title: 'Book ski/snowboard rental',
      category: 'ski',
      dueBy: before(takeoff, 7 * DAY_MS),
    },
  ];
}
