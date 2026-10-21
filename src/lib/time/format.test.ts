import { describe, expect, it } from 'vitest';
import { trip } from '../../data/trip';
import { formatDayRange, formatDuration, formatInZone } from './format';

describe('formatInZone', () => {
  it('shows the outbound departure in Israel time', () => {
    const { outbound } = trip;
    expect(formatInZone(outbound.departure, outbound.from.timeZone)).toEqual({
      time: '05:15',
      date: 'Wed 24 Feb 2027',
      offset: 'UTC+2',
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
