/**
 * Turns a Google Calendar iCal feed into whitelisted trip events.
 *
 * Supported: UTC and TZID times (VTIMEZONEs from the feed), all-day events,
 * RRULE recurrence with EXDATE and RECURRENCE-ID overrides (via ical.js).
 * Not supported: RDATE-only recurrences, VTODO/VJOURNAL, attachments.
 * Only title (SUMMARY), start, end, all-day and LOCATION are kept; descriptions,
 * attendees, organizer, URLs and emails never leave this function.
 */
import ICAL from 'ical.js';
import {
  MAX_EVENTS,
  MAX_LOCATION_CHARS,
  MAX_TITLE_CHARS,
  type ItineraryEvent,
} from '../../../src/lib/itinerary/types';

export interface DayRange {
  /** Inclusive first day (YYYY-MM-DD) */
  from: string;
  /** Inclusive last day (YYYY-MM-DD) */
  to: string;
}

/** Days of slack around the window for the cheap text pre-filter (time zones, multi-day events). */
const PREFILTER_SLACK_DAYS = 2;
/** Safety cap on recurrence expansion per event. */
const MAX_OCCURRENCES_SCANNED = 1000;
const DAY_MS = 86_400_000;

const compact = (day: string) => day.replaceAll('-', '');
const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Keeps only VEVENT blocks that can touch the window: recurring ones (or their
 * overrides) and ones whose DTSTART falls near it. The feed holds the calendar's
 * whole history, so this keeps parsing within the Worker's CPU budget.
 */
export function prefilterIcs(text: string, range: DayRange): string {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const firstEvent = unfolded.indexOf('BEGIN:VEVENT');
  if (firstEvent === -1) return unfolded;
  const header = unfolded.slice(0, firstEvent);
  const lo = compact(shiftDay(range.from, -PREFILTER_SLACK_DAYS));
  const hi = compact(shiftDay(range.to, PREFILTER_SLACK_DAYS));
  const kept: string[] = [];
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  for (const block of blocks) {
    if (/^(RRULE|RECURRENCE-ID)[;:]/m.test(block)) {
      kept.push(block);
      continue;
    }
    const start = block.match(/^DTSTART[^:\n]*:(\d{8})/m)?.[1];
    const end = block.match(/^DTEND[^:\n]*:(\d{8})/m)?.[1] ?? start;
    // Keep if [start, end] overlaps [lo, hi] (string compare works for YYYYMMDD).
    if (start && end && start <= hi && end >= lo) kept.push(block);
  }
  return `${header}${kept.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
}

/** FNV-1a: a short, stable, non-reversible id (we never expose calendar UIDs). */
function hashId(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

function toEvent(
  uid: string,
  summary: unknown,
  location: unknown,
  start: ICAL.Time,
  end: ICAL.Time,
): ItineraryEvent {
  const allDay = start.isDate;
  const iso = (t: ICAL.Time) => (allDay ? t.toString().slice(0, 10) : t.toJSDate().toISOString());
  const title = clean(summary, MAX_TITLE_CHARS) || 'Untitled';
  const place = clean(location, MAX_LOCATION_CHARS);
  return {
    id: hashId(`${uid}|${start.toString()}`),
    title,
    start: iso(start),
    end: iso(end),
    allDay,
    ...(place ? { location: place } : {}),
  };
}

/** Whether an event overlaps the window (dates in the trip's zone, end exclusive). */
function overlaps(
  event: ItineraryEvent,
  range: DayRange,
  windowStartMs: number,
  windowEndMs: number,
) {
  if (event.allDay) return event.start <= range.to && event.end > range.from;
  return Date.parse(event.start) < windowEndMs && Date.parse(event.end) > windowStartMs;
}

/**
 * Parses the feed and returns events overlapping `range` (inclusive days in
 * `timeZone`), sorted by start.
 */
export function parseItinerary(
  icsText: string,
  range: DayRange,
  windowStartMs: number,
  windowEndMs: number,
): ItineraryEvent[] {
  const root = new ICAL.Component(ICAL.parse(prefilterIcs(icsText, range)));
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(tz);
  }

  const vevents = root.getAllSubcomponents('vevent');
  const exceptions = new Map<string, ICAL.Event[]>();
  const masters: ICAL.Event[] = [];
  for (const v of vevents) {
    const event = new ICAL.Event(v);
    if (event.isRecurrenceException()) {
      const list = exceptions.get(event.uid) ?? [];
      list.push(event);
      exceptions.set(event.uid, list);
    } else {
      masters.push(event);
    }
  }

  const out: ItineraryEvent[] = [];
  for (const event of masters) {
    for (const ex of exceptions.get(event.uid) ?? []) event.relateException(ex);
    if (!event.isRecurring()) {
      out.push(toEvent(event.uid, event.summary, event.location, event.startDate, event.endDate));
      continue;
    }
    const it = event.iterator();
    for (let i = 0, next = it.next(); next && i < MAX_OCCURRENCES_SCANNED; i++, next = it.next()) {
      if (next.toJSDate().getTime() > windowEndMs) break;
      const details = event.getOccurrenceDetails(next);
      out.push(
        toEvent(
          event.uid,
          details.item.summary,
          details.item.location,
          details.startDate,
          details.endDate,
        ),
      );
    }
  }

  return out
    .filter((e) => overlaps(e, range, windowStartMs, windowEndMs))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    .slice(0, MAX_EVENTS);
}
