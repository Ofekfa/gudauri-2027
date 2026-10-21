import { localDateIn } from '../time/countdown';
import { formatInZone, zonedTimeToIso } from '../time/format';

/** To-do deadlines are shown and entered in Israel time (we prepare from home). */
export const TODO_TIME_ZONE = 'Asia/Jerusalem';
/** A date picked without a time means "by the end of that day". */
export const END_OF_DAY = '23:59';

/** "by Wed 10 Feb 2027" or "by Wed 24 Feb 2027, 02:15". */
export function formatDue(dueBy: string): string {
  const { date, time } = formatInZone(dueBy, TODO_TIME_ZONE);
  return time === END_OF_DAY ? `by ${date}` : `by ${date}, ${time}`;
}

/** Value for <input type="date"> (YYYY-MM-DD in Israel time). */
export const dueToDateInput = (dueBy: string) => localDateIn(Date.parse(dueBy), TODO_TIME_ZONE);

/**
 * A date from <input type="date"> → deadline. Keeps the previous time of day
 * (e.g. a 02:15 check-in deadline), otherwise end of day.
 */
export function dateInputToDue(day: string, previousDueBy?: string): string {
  const time = previousDueBy ? formatInZone(previousDueBy, TODO_TIME_ZONE).time : END_OF_DAY;
  return zonedTimeToIso(day, time, TODO_TIME_ZONE);
}
