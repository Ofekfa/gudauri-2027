export interface LocalTime {
  /** 24h clock, e.g. "05:15". */
  time: string;
  /** e.g. "Wed 24 Feb 2027". */
  date: string;
  /** e.g. "UTC+2". */
  offset: string;
}

const LOCALE = 'en-GB';

/** Formats an absolute instant in a specific IANA zone — never the viewer's zone. */
export function formatInZone(iso: string, timeZone: string): LocalTime {
  const instant = Date.parse(iso);
  const time = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  // Assembled from parts so punctuation is identical across ICU versions/browsers.
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const date = `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`;
  return { time, date, offset: utcOffsetLabel(instant, timeZone) };
}

export function utcOffsetLabel(instantMs: number, timeZone: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(instantMs)
    .find((p) => p.type === 'timeZoneName');
  // shortOffset yields "GMT+2" / "GMT+5:30" / "GMT".
  const raw = part?.value ?? 'GMT';
  return raw === 'GMT' ? 'UTC' : raw.replace('GMT', 'UTC');
}

/** Duration between two instants as "2h 40m". */
export function formatDuration(fromIso: string, toIso: string): string {
  const minutes = Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Calendar range "24–28 Feb 2027" from two YYYY-MM-DD dates (same month assumed by format). */
export function formatDayRange(firstDay: string, lastDay: string): string {
  const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', ...opts }).format(Date.parse(day));
  const sameMonth = firstDay.slice(0, 7) === lastDay.slice(0, 7);
  const start = fmt(firstDay, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const end = fmt(lastDay, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${start}–${end}`;
}

/** "22 Oct 2026" for a calendar day (YYYY-MM-DD), independent of the viewer's zone. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(Date.parse(`${day}T00:00:00Z`));
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function formatAgo(thenMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - thenMs);
  if (diff < MINUTE_MS) return 'just now';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} min ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} h ago`;
  const days = Math.floor(diff / DAY_MS);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Offset of `timeZone` from UTC at `instantMs`, in minutes (e.g. +120 for Israel in winter). */
export function zoneOffsetMinutes(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instantMs);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / 60_000);
}

/**
 * The instant at wall-clock `day` + `time` in `timeZone`, as a UTC ISO string.
 * e.g. ("2027-02-10", "23:59", "Asia/Jerusalem") → "2027-02-10T21:59:00.000Z".
 */
export function zonedTimeToIso(day: string, time: string, timeZone: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle a DST change between the guess and the answer.
  const first = guess - zoneOffsetMinutes(guess, timeZone) * 60_000;
  const second = guess - zoneOffsetMinutes(first, timeZone) * 60_000;
  return new Date(second).toISOString();
}
