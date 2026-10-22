import { formatInZone } from '../../lib/time/format';
import type { ItineraryEntry } from '../../lib/itinerary/plan';
import { Icon } from '../Icon';

interface EntryListProps {
  entries: ItineraryEntry[];
  timeZone: string;
  nowIds?: Set<string>;
  nextId?: string | null;
}

function timeRange(entry: ItineraryEntry, timeZone: string): string {
  if (entry.allDay) return 'All day';
  const start = formatInZone(entry.start, timeZone);
  const end = formatInZone(entry.end, timeZone);
  if (start.time === end.time && start.date === end.date) return start.time;
  // Ends after midnight (e.g. the flight home): mark the next day.
  return `${start.time}–${end.time}${end.date !== start.date ? ' +1' : ''}`;
}

/** One day's entries. Titles come from the calendar (often Hebrew), so direction is auto. */
export function EntryList({ entries, timeZone, nowIds, nextId }: EntryListProps) {
  return (
    <ol class="itin-list">
      {entries.map((e) => {
        const isNow = nowIds?.has(e.id) ?? false;
        const isNext = nextId === e.id;
        return (
          <li
            key={`${e.id}-${e.start}`}
            class={`itin-entry${e.kind === 'flight' ? ' itin-entry--flight' : ''}${isNow ? ' is-now' : ''}`}
            aria-current={isNow ? 'time' : undefined}
          >
            <span class="itin-entry__time">{timeRange(e, timeZone)}</span>
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
