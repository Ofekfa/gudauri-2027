/**
 * Exchange-rate payloads, shared by the Worker (/rates) and the site.
 * All rates are expressed as GEL per 1 unit of the other currency.
 */

export const CURRENCIES = ['ILS', 'GEL', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];
export type ForeignCurrency = Exclude<Currency, 'GEL'>;

export type RatesSource = 'nbg' | 'er-api';

export interface RatesPayload {
  base: 'GEL';
  /** GEL per 1 ILS / 1 EUR. */
  gelPer: Record<ForeignCurrency, number>;
  /** Day the rates apply to (YYYY-MM-DD). */
  validFrom: string;
  source: RatesSource;
  /** ISO time the Worker fetched them. */
  fetchedAt: string;
  /** True when served from cache after an upstream failure. */
  stale: boolean;
}

export type Rates = Pick<RatesPayload, 'gelPer' | 'validFrom' | 'source'>;

/** Plausibility bounds; anything outside is treated as a broken upstream. */
export const RATE_BOUNDS: Record<ForeignCurrency, { min: number; max: number }> = {
  ILS: { min: 0.3, max: 3 },
  EUR: { min: 1, max: 10 },
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function checkRates(gelPer: Record<ForeignCurrency, number>): Record<ForeignCurrency, number> {
  for (const code of ['ILS', 'EUR'] as const) {
    const value = gelPer[code];
    const { min, max } = RATE_BOUNDS[code];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`Implausible ${code} rate: ${value}`);
    }
  }
  return gelPer;
}

/**
 * National Bank of Georgia JSON (unfiltered):
 * [{ date, currencies: [{ code, quantity, rate, validFromDate, ... }] }].
 * `rate` is GEL per `quantity` units (ILS is quoted per 10).
 */
export function parseNbgResponse(raw: unknown): Rates {
  const day = Array.isArray(raw) ? raw[0] : null;
  if (!isRecord(day) || !Array.isArray(day.currencies)) throw new Error('Unexpected NBG shape');
  const currencies: unknown[] = day.currencies;
  const pick = (code: ForeignCurrency) => {
    const entry = currencies.find((c) => isRecord(c) && c.code === code);
    if (!isRecord(entry)) throw new Error(`NBG lacks ${code}`);
    const { rate, quantity, validFromDate } = entry;
    if (typeof rate !== 'number' || typeof quantity !== 'number' || quantity <= 0) {
      throw new Error(`Bad NBG ${code} entry`);
    }
    return { perUnit: rate / quantity, validFrom: String(validFromDate ?? day.date).slice(0, 10) };
  };
  const ils = pick('ILS');
  const eur = pick('EUR');
  if (!isDay(ils.validFrom)) throw new Error('Bad NBG date');
  return {
    gelPer: checkRates({ ILS: ils.perUnit, EUR: eur.perUnit }),
    validFrom: ils.validFrom,
    source: 'nbg',
  };
}

/** open.er-api.com /v6/latest/GEL: { result: "success", rates: { ILS: <ILS per GEL>, EUR }, time_last_update_unix }. */
export function parseErApiResponse(raw: unknown): Rates {
  if (!isRecord(raw) || raw.result !== 'success' || !isRecord(raw.rates)) {
    throw new Error('Unexpected ER-API shape');
  }
  const { ILS, EUR } = raw.rates;
  if (typeof ILS !== 'number' || typeof EUR !== 'number' || ILS <= 0 || EUR <= 0) {
    throw new Error('ER-API lacks ILS/EUR');
  }
  const updated = Number(raw.time_last_update_unix);
  const validFrom = Number.isFinite(updated)
    ? new Date(updated * 1000).toISOString().slice(0, 10)
    : '';
  if (!isDay(validFrom)) throw new Error('Bad ER-API date');
  return { gelPer: checkRates({ ILS: 1 / ILS, EUR: 1 / EUR }), validFrom, source: 'er-api' };
}

/** Validates an already-normalized Rates object (e.g. from cache). */
export function validateRates(raw: unknown): Rates {
  if (!isRecord(raw) || !isRecord(raw.gelPer) || !isDay(raw.validFrom))
    throw new Error('Bad rates');
  if (raw.source !== 'nbg' && raw.source !== 'er-api') throw new Error('Bad rates source');
  const gelPer = checkRates({ ILS: Number(raw.gelPer.ILS), EUR: Number(raw.gelPer.EUR) });
  return { gelPer, validFrom: raw.validFrom, source: raw.source };
}

/** Validates the Worker's response on the client. */
export function validateRatesPayload(raw: unknown): RatesPayload {
  const rates = validateRates(raw);
  const r = raw as Record<string, unknown>;
  if (
    r.base !== 'GEL' ||
    typeof r.fetchedAt !== 'string' ||
    Number.isNaN(Date.parse(r.fetchedAt))
  ) {
    throw new Error('Bad rates payload');
  }
  return { ...rates, base: 'GEL', fetchedAt: r.fetchedAt, stale: r.stale === true };
}
