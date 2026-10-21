import { describe, expect, it } from 'vitest';
import { trip } from '../../data/trip';
import {
  formatAgo,
  formatDay,
  formatDayRange,
  formatDuration,
  formatInZone,
  zonedTimeToIso,
  zoneOffsetMinutes,
} from './format';

describe('formatInZone', () => {
  it('shows the outbound departure in Israel time', () => {
    const { outbound } = trip;
    expect(formatInZone(outbound.departure, outbound.from.timeZone)).toEqual({
      time: '05:15',
      date: 'Wed 24 Feb 2027',
      offset: 'UTC+2',
    });
  });

  it('shows the outbound arrival in Tbilisi time', () => {
    const { outbound } = trip;
    expect(formatInZone(outbound.arrival, outbound.to.timeZone)).toEqual({
      time: '09:50',
      date: 'Wed 24 Feb 2027',
      offset: 'UTC+4',
    });
  });

  it('shows the return flight in each airport’s local time', () => {
    const { inbound } = trip;
    expect(formatInZone(inbound.departure, inbound.from.timeZone)).toMatchObject({
      time: '23:55',
      offset: 'UTC+4',
    });
    expect(formatInZone(inbound.arrival, inbound.to.timeZone)).toMatchObject({
      time: '00:35',
      date: 'Mon 1 Mar 2027',
      offset: 'UTC+2',
    });
  });
});

describe('formatDuration', () => {
  it('computes flight duration across zones', () => {
    expect(formatDuration(trip.outbound.departure, trip.outbound.arrival)).toBe('2h 35m');
    expect(formatDuration(trip.inbound.departure, trip.inbound.arrival)).toBe('2h 40m');
  });
});

describe('formatDayRange', () => {
  it('formats the trip dates', () => {
    expect(formatDayRange(trip.firstDay, trip.lastDay)).toBe('24–28 Feb 2027');
  });
  it('handles ranges across months', () => {
    expect(formatDayRange('2027-02-27', '2027-03-02')).toBe('27 Feb–2 Mar 2027');
  });
});

describe('formatDay / formatAgo', () => {
  it('formats calendar days without zone drift', () => {
    expect(formatDay('2026-10-22')).toBe('22 Oct 2026');
  });

  it('describes elapsed time', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    expect(formatAgo(now - 10_000, now)).toBe('just now');
    expect(formatAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatAgo(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(formatAgo(now - 26 * 3_600_000, now)).toBe('1 day ago');
    expect(formatAgo(now + 5_000, now)).toBe('just now');
  });
});

describe('zone helpers', () => {
  it('reports UTC offsets in minutes', () => {
    expect(zoneOffsetMinutes(Date.parse('2027-02-10T12:00:00Z'), 'Asia/Jerusalem')).toBe(120);
    expect(zoneOffsetMinutes(Date.parse('2027-07-10T12:00:00Z'), 'Asia/Jerusalem')).toBe(180);
    expect(zoneOffsetMinutes(Date.parse('2027-02-10T12:00:00Z'), 'Asia/Tbilisi')).toBe(240);
  });

  it('turns a wall-clock time in a zone into an instant, regardless of the host zone', () => {
    expect(zonedTimeToIso('2027-02-10', '23:59', 'Asia/Jerusalem')).toBe(
      '2027-02-10T21:59:00.000Z',
    );
    expect(zonedTimeToIso('2027-07-10', '09:00', 'Asia/Jerusalem')).toBe(
      '2027-07-10T06:00:00.000Z',
    );
    expect(zonedTimeToIso('2027-02-24', '09:50', 'Asia/Tbilisi')).toBe('2027-02-24T05:50:00.000Z');
  });
});
