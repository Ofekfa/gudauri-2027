import type { Currency, ForeignCurrency } from './rates';

export type GelPer = Record<ForeignCurrency, number>;

const gelPerUnit = (currency: Currency, gelPer: GelPer) =>
  currency === 'GEL' ? 1 : gelPer[currency];

/** Converts through GEL, the currency NBG quotes everything in. */
export function convert(amount: number, from: Currency, to: Currency, gelPer: GelPer): number {
  if (from === to) return amount;
  return (amount * gelPerUnit(from, gelPer)) / gelPerUnit(to, gelPer);
}

const CENTS = 100;
export const roundMoney = (value: number) => Math.round(value * CENTS) / CENTS;

/** Friendly rounding for mental-math tables: whole units under 50, fives under 200, tens above. */
export function friendlyRound(value: number): number {
  const step = value < 50 ? 1 : value < 200 ? 5 : 10;
  return Math.round(value / step) * step;
}

export const MAX_AMOUNT = 1_000_000_000;

/**
 * Parses what people type on a phone keyboard: "12", "12.5", "12,5", "1,234.50", "1 234".
 * Returns null for empty, negative or absurd input.
 */
export function parseAmount(text: string): number | null {
  const compact = text.replace(/[\s ]/g, '');
  if (!compact) return null;
  const normalized = compact.includes('.') ? compact.replace(/,/g, '') : compact.replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(normalized)) return null;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT ? value : null;
}

const formatters = new Map<Currency, Intl.NumberFormat>();

/** "₾10.00", "₪11.90", "€3.43" */
export function formatMoney(value: number, currency: Currency): string {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    });
    formatters.set(currency, f);
  }
  return f.format(value);
}

/** GEL amounts that come up in Gudauri (coffee, khachapuri, lift extras, taxis). */
export const GEL_TABLE_AMOUNTS = [5, 10, 20, 50, 85, 100, 125, 200] as const;
export const ILS_TABLE_AMOUNTS = [10, 20, 50, 100, 200, 500] as const;

export interface TableRow {
  amount: number;
  /** Friendly-rounded converted value (shown with "≈"). */
  approx: number;
  exact: number;
}

export function quickTable(
  amounts: readonly number[],
  from: Currency,
  to: Currency,
  gelPer: GelPer,
): TableRow[] {
  return amounts.map((amount) => {
    const exact = convert(amount, from, to, gelPer);
    return { amount, exact: roundMoney(exact), approx: friendlyRound(exact) };
  });
}
