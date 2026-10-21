import { describe, expect, it } from 'vitest';
import {
  convert,
  friendlyRound,
  GEL_TABLE_AMOUNTS,
  ILS_TABLE_AMOUNTS,
  parseAmount,
  quickTable,
  roundMoney,
} from './convert';

/** Real NBG rates on 2026-10-22. */
const RATES = { ILS: 0.83994, EUR: 2.9163 };

describe('convert', () => {
  it('converts through GEL in every direction', () => {
    expect(roundMoney(convert(10, 'GEL', 'ILS', RATES))).toBe(11.91);
    expect(roundMoney(convert(100, 'ILS', 'GEL', RATES))).toBe(83.99);
    expect(roundMoney(convert(10, 'EUR', 'GEL', RATES))).toBe(29.16);
    expect(roundMoney(convert(100, 'ILS', 'EUR', RATES))).toBe(28.8);
    expect(convert(42, 'EUR', 'EUR', RATES)).toBe(42);
  });

  it('round-trips', () => {
    const there = convert(123.45, 'ILS', 'EUR', RATES);
    expect(convert(there, 'EUR', 'ILS', RATES)).toBeCloseTo(123.45, 9);
  });
});

describe('friendlyRound', () => {
  it('rounds to 1s below 50, 5s below 200 and 10s above', () => {
    expect([11.9, 23.81, 42, 59.53, 148.8, 238].map(friendlyRound)).toEqual([
      12, 24, 42, 60, 150, 240,
    ]);
  });
});

describe('quickTable', () => {
  it('matches our mental model (10≈12, 50≈60, 85≈100, 125≈150) at today’s rate', () => {
    const rows = quickTable(GEL_TABLE_AMOUNTS, 'GEL', 'ILS', RATES);
    const approx = Object.fromEntries(rows.map((r) => [r.amount, r.approx]));
    expect(approx[10]).toBe(12);
    expect(approx[50]).toBe(60);
    expect(approx[85]).toBe(100);
    expect(approx[125]).toBe(150);
    expect(rows).toHaveLength(GEL_TABLE_AMOUNTS.length);
  });

  it('builds the reverse ILS → GEL table', () => {
    const rows = quickTable(ILS_TABLE_AMOUNTS, 'ILS', 'GEL', RATES);
    expect(rows.find((r) => r.amount === 100)).toEqual({ amount: 100, exact: 83.99, approx: 85 });
  });
});

describe('parseAmount', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['1,234.50', 1234.5],
    ['1 234', 1234],
    ['.5', 0.5],
    ['7.', 7],
  ])('%s → %s', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it.each(['', '  ', '-5', 'abc', '1.2.3', '1e5', '99999999999'])('rejects %j', (text) => {
    expect(parseAmount(text)).toBeNull();
  });
});
