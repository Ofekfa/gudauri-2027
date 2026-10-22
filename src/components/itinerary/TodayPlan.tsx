import { useMemo } from 'preact/hooks';
import { getTripPhase } from '../../lib/time/countdown';
import { trip } from '../../data/trip';
import { displayZone, groupByDay, mergeEntries, nowNext } from '../../lib/itinerary/plan';
import { useItinerary } from '../../lib/itinerary/useItinerary';
import { href } from '../../lib/router/hashRouter';
import { localDateIn } from '../../lib/time/countdown';
import { Icon } from '../Icon';
import { EntryList } from './EntryList';

const TZ = trip.destinationTimeZone;

/** Home card during the trip: today's plan with what's on now and next. */
export function TodayPlan() {
  const { data } = useItinerary();
  const now = Date.now();
  const today = localDateIn(now, TZ);
  const entries = useMemo(() => mergeEntries(trip, data?.events ?? []), [data]);
  const todays = groupByDay(entries, [today], (e) => displayZone(e, trip)).get(today) ?? [];
  // Now/next only make sense while we're actually on the trip.
  const during = getTripPhase(now, trip).kind === 'during';
  const { now: current, next } = during ? nowNext(entries, now) : { now: [], next: null };

  return (
    <section class="card next-todos" aria-labelledby="today-plan-title">
      <h2 id="today-plan-title" class="next-todos__title">
        <Icon name="calendar" size={20} /> Today’s plan
      </h2>
      {todays.length ? (
        <EntryList
          entries={todays}
          nowIds={new Set(current.map((e) => e.id))}
          nextId={next?.id ?? null}
        />
      ) : (
        <p class="next-todos__empty">Nothing planned today. Enjoy the snow!</p>
      )}
      <a class="next-todos__more" href={href('/itinerary')}>
        Full itinerary →
      </a>
    </section>
  );
}
