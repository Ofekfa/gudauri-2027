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
