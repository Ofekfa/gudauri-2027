import { describe, expect, it } from 'vitest';
import { trip } from '../../data/trip';
import { getTripPhase, localDateIn, splitDuration, tripTotalDays } from './countdown';

const at = (iso: string) => Date.parse(iso);

describe('splitDuration', () => {
  it('splits into d/h/m/s', () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;
    expect(splitDuration(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });
  it('never goes negative', () => {
    expect(splitDuration(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('getTripPhase', () => {
  it('counts down to takeoff before departure', () => {
    const phase = getTripPhase(at('2027-02-24T05:14:59+02:00'), trip);
    expect(phase).toEqual({ kind: 'before', remainingMs: 1000 });
  });

  it('is exactly one day before at 05:15 Israel time the day before', () => {
    const phase = getTripPhase(at('2027-02-23T03:15:00Z'), trip);
    expect(phase).toEqual({ kind: 'before', remainingMs: 24 * 3600 * 1000 });
  });

  it('switches to Day 1 at takeoff', () => {
    expect(getTripPhase(at('2027-02-24T05:15:00+02:00'), trip)).toEqual({
      kind: 'during',
      day: 1,
      totalDays: 5,
    });
  });

  it('uses the Tbilisi calendar date for the day number', () => {
    // 21:30 Israel = 23:30 Tbilisi on the 25th → Day 2
    expect(getTripPhase(at('2027-02-25T21:30:00+02:00'), trip)).toMatchObject({ day: 2 });
    // 22:30 Israel = 00:30 Tbilisi on the 26th → Day 3
    expect(getTripPhase(at('2027-02-25T22:30:00+02:00'), trip)).toMatchObject({ day: 3 });
  });

  it('is Day 5 on the last day and still Day 5 on the flight home after midnight', () => {
    expect(getTripPhase(at('2027-02-28T12:00:00+04:00'), trip)).toMatchObject({ day: 5 });
    expect(getTripPhase(at('2027-03-01T00:20:00+02:00'), trip)).toMatchObject({ day: 5 });
  });

  it('is over once we land in Tel Aviv', () => {
    expect(getTripPhase(at('2027-03-01T00:35:00+02:00'), trip)).toEqual({ kind: 'after' });
  });
});

describe('helpers', () => {
  it('trip spans 5 days', () => {
    expect(tripTotalDays(trip)).toBe(5);
  });
  it('localDateIn respects the zone, not the host', () => {
    const instant = at('2027-02-24T21:00:00Z');
    expect(localDateIn(instant, 'Asia/Tbilisi')).toBe('2027-02-25');
    expect(localDateIn(instant, 'America/New_York')).toBe('2027-02-24');
  });
});
