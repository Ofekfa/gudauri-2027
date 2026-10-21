import { describe, expect, it } from 'vitest';
import { dateInputToDue, dueToDateInput, formatDue } from './due';

describe('due date helpers (Israel time)', () => {
  it('formats end-of-day deadlines without a time and others with one', () => {
    expect(formatDue('2027-02-10T21:59:00.000Z')).toBe('by Wed 10 Feb 2027');
    expect(formatDue('2027-02-24T00:15:00.000Z')).toBe('by Wed 24 Feb 2027, 02:15');
  });

  it('converts to and from the date input', () => {
    expect(dateInputToDue('2027-02-10')).toBe('2027-02-10T21:59:00.000Z');
    expect(dueToDateInput('2027-02-10T21:59:00.000Z')).toBe('2027-02-10');
    // 22:30 UTC is already the next day in Israel.
    expect(dueToDateInput('2027-02-10T22:30:00.000Z')).toBe('2027-02-11');
  });

  it('keeps the original time of day when the date changes', () => {
    expect(dateInputToDue('2027-02-23', '2027-02-24T00:15:00.000Z')).toBe(
      '2027-02-23T00:15:00.000Z',
    );
  });
});
