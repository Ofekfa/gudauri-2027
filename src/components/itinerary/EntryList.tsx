import { trip } from '../../data/trip';
import { displayZone, flightTimes, type ItineraryEntry } from '../../lib/itinerary/plan';
import { formatInZone } from '../../lib/time/format';
import { Icon } from '../Icon';

interface EntryListProps {
  entries: ItineraryEntry[];
  nowIds?: Set<string>;
  nextId?: string | null;
}

function timeRange(entry: ItineraryEntry, timeZone: string): string {
  if (entry.allDay) return 'All day';
  if (entry.leg) {
    // Our flights: booking times, each in its own airport's time.
    const f = flightTimes(entry.leg, trip);
    return `${f.depart} ${f.from} → ${f.arrive ?? 'TBC'} ${f.to}${f.nextDay ? ' +1' : ''}`;
  }
  const start = formatInZone(entry.start, timeZone);
  const end = formatInZone(entry.end, timeZone);
  if (start.time === end.time && start.date === end.date) return start.time;
  // Ends after midnight (e.g. the flight home): mark the next day.
  return `${start.time}–${end.time}${end.date !== start.date ? ' +1' : ''}`;
}

/**
 * One day's entries, in Georgia time except before we land (Israel time,
 * labelled). Titles come from the calendar (often Hebrew), so direction is auto.
 */
export function EntryList({ entries, nowIds, nextId }: EntryListProps) {
  return (
    <ol class="itin-list">
      {entries.map((e) => {
        const isNow = nowIds?.has(e.id) ?? false;
        const isNext = nextId === e.id;
        const zone = displayZone(e, trip);
        const inIsrael = !e.leg && zone !== trip.destinationTimeZone;
        return (
          <li
            key={`${e.id}-${e.start}`}
            class={`itin-entry${e.kind === 'flight' ? ' itin-entry--flight' : ''}${isNow ? ' is-now' : ''}`}
            aria-current={isNow ? 'time' : undefined}
          >
            <span class="itin-entry__time">
              {timeRange(e, zone)}
              {inIsrael && <span class="itin-entry__zone">Israel time</span>}
            </span>
            <span class="itin-entry__body">
              <span class="itin-entry__title" dir="auto">
                {e.kind === 'flight' && <Icon name="plane" size={16} />}
                {e.title}
                {isNow && <span class="itin-badge itin-badge--now">Now</span>}
                {isNext && <span class="itin-badge">Next</span>}
              </span>
              {e.location && (
                <span class="itin-entry__location" dir="auto">
                  {e.location}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
