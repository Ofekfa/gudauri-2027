import { useEffect, useState } from 'preact/hooks';
import type { RatesPayload } from './rates';
import { fetchRates, loadCachedRates, saveCachedRates } from './ratesClient';

export type RatesStatus = 'loading' | 'live' | 'offline' | 'unavailable';

/** Shows cached rates immediately, then refreshes from the Worker. */
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
        if (!cancelled) setStatus(loadCachedRates() ? 'offline' : 'unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { rates, status };
}
