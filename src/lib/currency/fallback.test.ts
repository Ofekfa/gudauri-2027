import { describe, expect, it } from 'vitest';
import { FALLBACK_RATES, FALLBACK_RATES_GENERATED_AT } from '../../data/fallbackRates';
import { convert } from './convert';
import { bakedPayload } from './fallback';
import { validateRates, validateRatesPayload } from './rates';

describe('baked fallback rate', () => {
  it('is a plausible, valid official rate', () => {
    expect(validateRates(FALLBACK_RATES)).toEqual(FALLBACK_RATES);
    expect(Number.isNaN(Date.parse(FALLBACK_RATES_GENERATED_AT))).toBe(false);
  });

  it('becomes a payload that is always marked stale and converts normally', () => {
    const payload = bakedPayload(
      { gelPer: { ILS: 0.84, EUR: 2.9 }, validFrom: '2026-10-22', source: 'nbg' },
      '2026-10-22T07:00:00.000Z',
    );
    expect(validateRatesPayload(payload)).toEqual(payload);
    expect(payload.stale).toBe(true);
    expect(payload.fetchedAt).toBe('2026-10-22T07:00:00.000Z');
    expect(convert(50, 'GEL', 'ILS', payload.gelPer)).toBeCloseTo(59.52, 2);
  });
});
