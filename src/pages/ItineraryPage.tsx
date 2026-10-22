import { useMemo } from 'preact/hooks';
import { EntryList } from '../components/itinerary/EntryList';
import { PageHeader } from '../components/PageHeader';
import { getTripPhase } from '../lib/time/countdown';
import { trip } from '../data/trip';
import { dayLabel, groupByDay, itineraryDays, mergeEntries, nowNext } from '../lib/itinerary/plan';
import { useItinerary } from '../lib/itinerary/useItinerary';
import { tripTotalDays } from '../lib/time/countdown';
import { formatAgo } from '../lib/time/format';

const TZ = trip.destinationTimeZone;

/** "Wed 24 Feb" for a calendar day. */
function dayTitle(day: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(Date.parse(`${day}T00:00:00Z`));
}

function daySubtitle(day: string): string {
  const label = dayLabel(day, trip);
  if (label.kind === 'before') return 'Before we fly';
  if (label.kind === 'after') return 'Landing home';
  return `Day ${label.dayNumber} of ${tripTotalDays(trip)}`;
}

function jumpTo(day: string) {
  const heading = document.getElementById(`day-${day}`);
  heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  heading?.focus({ preventScroll: true });
}

export default function ItineraryPage() {
  const { data, status } = useItinerary();
  const days = useMemo(() => itineraryDays(trip), []);
  const entries = useMemo(() => mergeEntries(trip, data?.events ?? []), [data]);
  const groups = useMemo(() => groupByDay(entries, days, TZ), [entries, days]);
  const now = Date.now();
  // Now/next only make sense while we're actually on the trip.
  const during = getTripPhase(now, trip).kind === 'during';
  const { now: current, next } = during ? nowNext(entries, now) : { now: [], next: null };
  const nowIds = new Set(current.map((e) => e.id));
  const calendarEvents = data?.events.length ?? 0;

  return (
    <>
      <PageHeader
        title="Itinerary"
        subtitle="Our day-by-day plan from the shared Google Calendar, in Georgia time (UTC+4)."
      />

      {status === 'not-configured' && !data && (
        <p class="note note--warning" role="status">
          The calendar isn’t connected yet, so only our flights are shown.
        </p>
      )}
      {status === 'unavailable' && !data && (
        <p class="note note--warning" role="alert">
          Couldn’t load the calendar. Check your connection; our flights are shown below.
        </p>
      )}
      {data && (status === 'offline' || data.stale) && (
        <p class="note note--warning" role="status">
          {status === 'offline'
            ? `Offline: showing the plan saved on this phone (updated ${formatAgo(Date.parse(data.fetchedAt), now)}).`
            : 'The calendar couldn’t be reached just now; this is the latest copy we have.'}
        </p>
      )}
      {status === 'loading' && !data && (
        <p class="page-loading" role="status">
          Loading the plan…
        </p>
      )}

      <nav class="filters__group itin-days" aria-label="Jump to day">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            class="chip-button chip-button--small"
            onClick={() => jumpTo(day)}
          >
            {dayTitle(day)}
          </button>
        ))}
      </nav>

      {days.map((day) => {
        const list = groups.get(day) ?? [];
        return (
          <section key={day} class="itin-day" aria-labelledby={`day-${day}`}>
            <h2 id={`day-${day}`} class="itin-day__title" tabIndex={-1}>
              {dayTitle(day)} <span class="itin-day__sub">{daySubtitle(day)}</span>
            </h2>
            {list.length ? (
              <EntryList entries={list} timeZone={TZ} nowIds={nowIds} nextId={next?.id ?? null} />
            ) : (
              <p class="empty-note itin-day__empty">Nothing planned.</p>
            )}
          </section>
        );
      })}

      <p class="rates-meta">
        {data
          ? `${calendarEvents} calendar event${calendarEvents === 1 ? '' : 's'} · updated ${formatAgo(Date.parse(data.fetchedAt), now)}. `
          : ''}
        Flights come from our booking details. Add or change plans in the shared Google Calendar;
        they show up here within about 20 minutes.
      </p>
    </>
  );
}
