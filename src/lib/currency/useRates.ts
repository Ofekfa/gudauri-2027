import { useEffect, useState } from 'preact/hooks';
import { bakedPayload } from './fallback';
import type { RatesPayload } from './rates';
import { fetchRates, loadCachedRates, saveCachedRates } from './ratesClient';

/** `approximate`: no saved rate and no connection, so the rate baked in at build time is shown. */
export type RatesStatus = 'loading' | 'live' | 'offline' | 'approximate';

/** Shows cached rates immediately, then refreshes from the Worker; falls back to the baked rate. */
export function useRates(): { rates: RatesPayload | null; status: RatesStatus } {
  const [rates, setRates] = useState<RatesPayload | null>(() => loadCachedRates());
  const [status, setStatus] = useState<RatesStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchRates()
      .then((fresh) => {
        if (cancelled) return;
        saveCachedRates(fresh);
        setRates(fresh);
        setStatus('live');
      })
      .catch(() => {
        if (cancelled) return;
        if (loadCachedRates()) {
          setStatus('offline');
        } else {
          setRates(bakedPayload());
          setStatus('approximate');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rates, status };
}
