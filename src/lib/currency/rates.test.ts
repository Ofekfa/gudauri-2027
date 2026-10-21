import { describe, expect, it } from 'vitest';
import { parseErApiResponse, parseNbgResponse, validateRates, validateRatesPayload } from './rates';

// Trimmed from a real NBG response (2026-10-22).
const NBG = [
  {
    date: '2026-10-22T00:00:00.000Z',
    currencies: [
      { code: 'EUR', quantity: 1, rate: 2.9163, validFromDate: '2026-10-22T00:00:00.000Z' },
      { code: 'ILS', quantity: 10, rate: 8.3994, validFromDate: '2026-10-22T00:00:00.000Z' },
      { code: 'USD', quantity: 1, rate: 2.69, validFromDate: '2026-10-22T00:00:00.000Z' },
    ],
  },
];

describe('parseNbgResponse', () => {
  it('normalizes per-quantity rates to GEL per unit', () => {
    expect(parseNbgResponse(NBG)).toEqual({
      gelPer: { ILS: 0.83994, EUR: 2.9163 },
      validFrom: '2026-10-22',
      source: 'nbg',
    });
  });

  it('rejects missing currencies, odd shapes and implausible values', () => {
    expect(() => parseNbgResponse([])).toThrow();
    expect(() => parseNbgResponse([{ currencies: [NBG[0]!.currencies[0]] }])).toThrow(/ILS/);
    const absurd = structuredClone(NBG);
    absurd[0]!.currencies[1]!.rate = 999;
    expect(() => parseNbgResponse(absurd)).toThrow(/Implausible/);
  });
});

describe('parseErApiResponse', () => {
  it('inverts "per GEL" rates', () => {
    const r = parseErApiResponse({
      result: 'success',
      time_last_update_unix: 1792540801,
      rates: { ILS: 1.19, EUR: 0.343 },
    });
    expect(r.source).toBe('er-api');
    expect(r.gelPer.ILS).toBeCloseTo(0.8403, 4);
    expect(r.gelPer.EUR).toBeCloseTo(2.9155, 4);
    expect(r.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects errors from the API', () => {
    expect(() => parseErApiResponse({ result: 'error' })).toThrow();
  });
});

describe('validation of cached and served data', () => {
  const rates = { gelPer: { ILS: 0.84, EUR: 2.92 }, validFrom: '2026-10-22', source: 'nbg' };

  it('accepts good data and rejects tampering', () => {
    expect(validateRates(rates)).toEqual(rates);
    expect(() => validateRates({ ...rates, source: 'x' })).toThrow();
    expect(() => validateRates({ ...rates, gelPer: { ILS: -1, EUR: 2.9 } })).toThrow();
  });

  it('validates the full client payload', () => {
    const payload = { ...rates, base: 'GEL', fetchedAt: '2026-10-22T10:00:00Z', stale: false };
    expect(validateRatesPayload(payload)).toEqual(payload);
    expect(() => validateRatesPayload({ ...payload, fetchedAt: 'nope' })).toThrow();
  });
});
