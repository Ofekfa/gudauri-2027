import { FALLBACK_RATES, FALLBACK_RATES_GENERATED_AT } from '../../data/fallbackRates';
import type { Rates, RatesPayload } from './rates';

/** The rate baked in at build time, as a payload. It's always marked stale. */
export function bakedPayload(
  rates: Rates = FALLBACK_RATES,
  generatedAt: string = FALLBACK_RATES_GENERATED_AT,
): RatesPayload {
  return { base: 'GEL', ...rates, fetchedAt: generatedAt, stale: true };
}
