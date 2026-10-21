import { useMemo, useState } from 'preact/hooks';
import { PageHeader } from '../components/PageHeader';
import {
  convert,
  formatMoney,
  GEL_TABLE_AMOUNTS,
  ILS_TABLE_AMOUNTS,
  parseAmount,
  quickTable,
  type GelPer,
  type TableRow,
} from '../lib/currency/convert';
import { CURRENCIES, type Currency, type RatesPayload } from '../lib/currency/rates';
import { useRates } from '../lib/currency/useRates';
import { formatAgo, formatDay } from '../lib/time/format';

/** Short labels so both selects fit side by side at 375 px. */
const CURRENCY_NAME: Record<Currency, string> = {
  ILS: '₪ ILS',
  GEL: '₾ GEL',
  EUR: '€ EUR',
};
const DEFAULT_AMOUNT = '10';

function SourceLine({ rates }: { rates: RatesPayload }) {
  const updated = formatAgo(Date.parse(rates.fetchedAt), Date.now());
  return rates.source === 'nbg' ? (
    <>
      Official rates from the{' '}
      <a
        href="https://nbg.gov.ge/en/monetary-policy/currency"
        target="_blank"
        rel="noopener noreferrer"
      >
        National Bank of Georgia
      </a>{' '}
      for {formatDay(rates.validFrom)} · checked {updated}.
    </>
  ) : (
    <>
      <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">
        Rates by Exchange Rate API
      </a>{' '}
      for {formatDay(rates.validFrom)} (the official source was unavailable) · checked {updated}.
    </>
  );
}

function RefTable({
  caption,
  from,
  to,
  rows,
}: {
  caption: string;
  from: Currency;
  to: Currency;
  rows: TableRow[];
}) {
  return (
    <table class="ref-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{from}</th>
          <th scope="col">≈ {to}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.amount}>
            <th scope="row">{formatMoney(r.amount, from).replace(/\.00$/, '')}</th>
            <td>
              <span aria-hidden="true">≈ </span>
              <span class="visually-hidden">about </span>
              {formatMoney(r.approx, to).replace(/\.00$/, '')}
              <span class="ref-table__exact"> ({formatMoney(r.exact, to)})</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Converter({ gelPer }: { gelPer: GelPer }) {
  const [text, setText] = useState(DEFAULT_AMOUNT);
  const [from, setFrom] = useState<Currency>('GEL');
  const [to, setTo] = useState<Currency>('ILS');
  const amount = parseAmount(text);
  const result = amount === null ? null : convert(amount, from, to, gelPer);

  const select = (id: string, label: string, value: Currency, onChange: (c: Currency) => void) => (
    <label class="converter__field">
      <span class="converter__label">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value as Currency)}>
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {CURRENCY_NAME[c]}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section class="card converter" aria-labelledby="converter-title">
      <h2 id="converter-title" class="visually-hidden">
        Converter
      </h2>
      <div class="converter__grid">
        <label class="converter__field converter__field--amount">
          <span class="converter__label">Amount</span>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            autocomplete="off"
            value={text}
            aria-invalid={text.trim() !== '' && amount === null}
            onInput={(e) => setText(e.currentTarget.value)}
          />
        </label>
        {select('from', 'From', from, setFrom)}
        <button
          type="button"
          class="icon-button converter__swap"
          aria-label="Swap currencies"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          ⇅
        </button>
        {select('to', 'To', to, setTo)}
      </div>
      <output class="converter__result" for="amount from to" aria-live="polite">
        {result === null ? (
          <span class="converter__hint">Type an amount, e.g. 25 or 12.50</span>
        ) : (
          <>
            {formatMoney(amount!, from)} = <strong>{formatMoney(result, to)}</strong>
          </>
        )}
      </output>
      <p class="converter__rates">
        1 GEL = {formatMoney(1 / gelPer.ILS, 'ILS')} · 1 ILS = {formatMoney(gelPer.ILS, 'GEL')} · 1
        EUR = {formatMoney(gelPer.EUR, 'GEL')}
      </p>
    </section>
  );
}

export default function CurrencyPage() {
  const { rates, status } = useRates();
  const tables = useMemo(
    () =>
      rates && {
        gelToIls: quickTable(GEL_TABLE_AMOUNTS, 'GEL', 'ILS', rates.gelPer),
        ilsToGel: quickTable(ILS_TABLE_AMOUNTS, 'ILS', 'GEL', rates.gelPer),
      },
    [rates],
  );

  return (
    <>
      <PageHeader
        title="Currency"
        subtitle="Israeli shekels (ILS), Georgian lari (GEL) and euros (EUR) at today’s official rate."
      />

      {!rates ? (
        status === 'loading' ? (
          <p class="page-loading" role="status">
            Loading today’s rates…
          </p>
        ) : (
          <p class="card" role="alert">
            Couldn’t load exchange rates. Check your connection and try again.
          </p>
        )
      ) : (
        <>
          {(status === 'offline' || rates.stale) && (
            <p class="note note--warning" role="status">
              {status === 'offline'
                ? `You’re offline: showing the last rates saved on this phone (${formatDay(rates.validFrom)}).`
                : 'The rate service is having trouble; these are the most recent rates we have.'}
            </p>
          )}
          <Converter gelPer={rates.gelPer} />

          <section aria-labelledby="ref-title">
            <h2 id="ref-title" class="section-title">
              Quick reference
            </h2>
            <div class="ref-tables">
              <RefTable caption="Lari → shekels" from="GEL" to="ILS" rows={tables!.gelToIls} />
              <RefTable caption="Shekels → lari" from="ILS" to="GEL" rows={tables!.ilsToGel} />
            </div>
          </section>

          <p class="rates-meta">
            <SourceLine rates={rates} />
          </p>
          <p class="rates-meta">
            Card, ATM and exchange-booth rates differ from official rates, so check the rate you’re
            actually offered.
          </p>
        </>
      )}
    </>
  );
}
