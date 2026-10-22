import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '../src/cache';
import type { Env, KvLike } from '../src/env';
import { handleRequest } from '../src/index';
import { parseItinerary, prefilterIcs } from '../src/itinerary/ics';
import { ITINERARY_CACHE_KEY, TRIP_RANGE } from '../src/routes/itinerary';

const ORIGIN = 'https://ofekfa.github.io';
const SECRET_URL = 'https://calendar.google.com/calendar/ical/secret-token-123/basic.ics';
const W_START = Date.parse(`${TRIP_RANGE.from}T00:00:00+04:00`);
const W_END = Date.parse('2027-03-02T00:00:00+04:00');

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Tbilisi',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0400',
  'TZOFFSETTO:+0400',
  'TZNAME:+04',
  'DTSTART:19700101T000000',
  'END:STANDARD',
  'END:VTIMEZONE',
];

function feed(...events: string[][]): string {
  return [
    'BEGIN:VCALENDAR',
    'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
    'VERSION:2.0',
    'X-WR-CALNAME:גיאורגיה',
    'X-WR-TIMEZONE:Asia/Tbilisi',
    ...VTIMEZONE,
    ...events.flat(),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

const ev = (uid: string, lines: string[]) => ['BEGIN:VEVENT', `UID:${uid}`, ...lines, 'END:VEVENT'];

const SAMPLE = feed(
  ev('utc@google', [
    'DTSTART:20270224T090000Z',
    'DTEND:20270224T110000Z',
    'SUMMARY:Ski lesson\\, beginners',
    'LOCATION:Pirveli lift\\, Gudauri',
    'DESCRIPTION:Booking ref ABC123 – private!',
    'ATTENDEE;CN=Someone:mailto:someone@example.com',
    'ORGANIZER:mailto:owner@example.com',
    'URL:https://example.com/private',
  ]),
  ev('tz@google', [
    'DTSTART;TZID=Asia/Tbilisi:20270225T130000',
    'DTEND;TZID=Asia/Tbilisi:20270225T150000',
    // A Hebrew title folded mid-word, as Google does at 75 bytes.
    'SUMMARY:ארוחת ער',
    ' ב בטביליסי',
  ]),
  ev('allday@google', [
    'DTSTART;VALUE=DATE:20270226',
    'DTEND;VALUE=DATE:20270227',
    'SUMMARY:Kazbegi day trip',
  ]),
  ev('daily@google', [
    'DTSTART;TZID=Asia/Tbilisi:20270220T080000',
    'DTEND;TZID=Asia/Tbilisi:20270220T090000',
    'RRULE:FREQ=DAILY;COUNT=10',
    'EXDATE;TZID=Asia/Tbilisi:20270225T080000',
    'SUMMARY:Breakfast',
  ]),
  ev('daily@google', [
    'RECURRENCE-ID;TZID=Asia/Tbilisi:20270226T080000',
    'DTSTART;TZID=Asia/Tbilisi:20270226T100000',
    'DTEND;TZID=Asia/Tbilisi:20270226T110000',
    'SUMMARY:Breakfast (late)',
  ]),
  ev('old@google', [
    'DTSTART:20261110T100000Z',
    'DTEND:20261110T110000Z',
    'SUMMARY:Unrelated old meeting',
  ]),
);

describe('parseItinerary', () => {
  const events = parseItinerary(SAMPLE, TRIP_RANGE, W_START, W_END);
  const titles = events.map((e) => e.title);

  it('keeps only whitelisted fields', () => {
    const lesson = events.find((e) => e.title.startsWith('Ski lesson'))!;
    expect(lesson).toEqual({
      id: expect.any(String),
      title: 'Ski lesson, beginners',
      start: '2027-02-24T09:00:00.000Z',
      end: '2027-02-24T11:00:00.000Z',
      allDay: false,
      location: 'Pirveli lift, Gudauri',
    });
    const json = JSON.stringify(events);
    for (const secret of ['ABC123', 'mailto', 'example.com', 'utc@google'])
      expect(json).not.toContain(secret);
  });

  it('converts TZID times to UTC and unfolds Hebrew titles', () => {
    expect(events.find((e) => e.title === 'ארוחת ערב בטביליסי')).toMatchObject({
      start: '2027-02-25T09:00:00.000Z',
      end: '2027-02-25T11:00:00.000Z',
    });
  });

  it('keeps all-day events as dates with an exclusive end', () => {
    expect(events.find((e) => e.title === 'Kazbegi day trip')).toMatchObject({
      start: '2027-02-26',
      end: '2027-02-27',
      allDay: true,
    });
  });

  it('expands recurrences in the window, honouring EXDATE and overrides', () => {
    const breakfasts = events.filter((e) => e.title.startsWith('Breakfast'));
    // Daily 20 Feb–1 Mar (COUNT=10); in the window 23 Feb–1 Mar, minus 25 Feb (EXDATE).
    expect(breakfasts.map((e) => e.start)).toEqual([
      '2027-02-23T04:00:00.000Z',
      '2027-02-24T04:00:00.000Z',
      '2027-02-26T06:00:00.000Z',
      '2027-02-27T04:00:00.000Z',
      '2027-02-28T04:00:00.000Z',
      '2027-03-01T04:00:00.000Z',
    ]);
    expect(breakfasts.find((e) => e.start.startsWith('2027-02-26'))?.title).toBe(
      'Breakfast (late)',
    );
  });

  it('drops events outside the trip and sorts by start', () => {
    expect(titles).not.toContain('Unrelated old meeting');
    expect([...events.map((e) => e.start)]).toEqual([...events.map((e) => e.start)].sort());
  });

  it('gives occurrences distinct, stable ids', () => {
    const again = parseItinerary(SAMPLE, TRIP_RANGE, W_START, W_END);
    expect(again.map((e) => e.id)).toEqual(events.map((e) => e.id));
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });
});

describe('performance on a large feed', () => {
  it('pre-filters a 2-year history quickly', () => {
    const history = Array.from({ length: 2000 }, (_, i) => {
      const day = new Date(Date.parse('2025-01-01T00:00:00Z') + i * 9 * 3_600_000);
      const stamp = day.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
      return ev(`h${i}@google`, [
        `DTSTART:${stamp}`,
        `DTEND:${stamp}`,
        `SUMMARY:Event ${i}`,
        'DESCRIPTION:' + 'x'.repeat(200),
      ]);
    });
    const big = feed(
      ...history,
      ...[ev('trip@google', ['DTSTART:20270227T100000Z', 'DTEND:20270227T120000Z', 'SUMMARY:Spa'])],
    );
    expect(prefilterIcs(big, TRIP_RANGE).length).toBeLessThan(big.length / 10);
    const t0 = performance.now();
    const events = parseItinerary(big, TRIP_RANGE, W_START, W_END);
    const ms = performance.now() - t0;
    expect(events.map((e) => e.title)).toEqual(['Spa']);
    console.info(
      `2000-event feed (${Math.round(big.length / 1024)} kB) parsed in ${ms.toFixed(1)} ms`,
    );
    expect(ms).toBeLessThan(100);
  });
});

describe('GET /itinerary', () => {
  function fakeKv(): KvLike & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      get: async (k) => data.get(k) ?? null,
      put: async (k, v) => void data.set(k, v),
    };
  }
  const env = (overrides: Partial<Env> = {}): Env => ({
    AI: { run: vi.fn() },
    RL_DATA: { limit: vi.fn().mockResolvedValue({ success: true }) },
    CACHE: fakeKv(),
    CALENDAR_ICS_URL: SECRET_URL,
    ALLOWED_ORIGINS: ORIGIN,
    MODEL: 'm',
    ...overrides,
  });
  const get = (e: Env) =>
    handleRequest(new Request('https://w.example/itinerary', { headers: { Origin: ORIGIN } }), e);
  const stubFetch = (impl: () => Promise<Response>) => {
    const fn = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => impl());
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  beforeEach(() => clearMemoryCache());
  afterEach(() => vi.unstubAllGlobals());

  it('is 501 until the secret is configured', async () => {
    const res = await get(env({ CALENDAR_ICS_URL: undefined }));
    expect(res.status).toBe(501);
  });

  it('serves whitelisted events for the trip window', async () => {
    const fetchMock = stubFetch(async () => new Response(SAMPLE));
    const res = await get(env());
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0]![0]).toBe(SECRET_URL);
    const body = (await res.json()) as {
      range: unknown;
      timeZone: string;
      events: { title: string }[];
      stale: boolean;
    };
    expect(body.range).toEqual({ from: '2027-02-23', to: '2027-03-01' });
    expect(body.timeZone).toBe('Asia/Tbilisi');
    expect(body.stale).toBe(false);
    expect(body.events.length).toBeGreaterThan(5);
    expect(JSON.stringify(body)).not.toContain('secret-token');
  });

  it('serves stale data when the calendar fails, and never leaks the URL', async () => {
    const kv = fakeKv();
    stubFetch(async () => new Response(SAMPLE));
    await get(env({ CACHE: kv }));
    const entry = JSON.parse(kv.data.get(ITINERARY_CACHE_KEY)!);
    entry.fetchedAt -= 60 * 60_000;
    kv.data.set(ITINERARY_CACHE_KEY, JSON.stringify(entry));
    clearMemoryCache();
    stubFetch(async () => new Response('nope', { status: 500 }));
    const res = await get(env({ CACHE: kv }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { stale: boolean }).stale).toBe(true);
  });

  it('returns 503 for a non-iCal response with nothing cached, without echoing the URL', async () => {
    stubFetch(async () => new Response('<html>login</html>'));
    const res = await get(env());
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('secret-token');
  });
});
