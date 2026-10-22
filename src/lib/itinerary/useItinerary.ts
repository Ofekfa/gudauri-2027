import { useEffect, useState } from 'preact/hooks';
import {
  fetchItinerary,
  ItineraryNotConfiguredError,
  loadCachedItinerary,
  saveCachedItinerary,
} from './itineraryClient';
import type { ItineraryPayload } from './types';

export type ItineraryStatus = 'loading' | 'live' | 'offline' | 'not-configured' | 'unavailable';

/** Shows the last saved itinerary immediately, then refreshes from the Worker. */
export function useItinerary(): { data: ItineraryPayload | null; status: ItineraryStatus } {
  const [data, setData] = useState<ItineraryPayload | null>(() => loadCachedItinerary());
  const [status, setStatus] = useState<ItineraryStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchItinerary()
      .then((fresh) => {
        if (cancelled) return;
        saveCachedItinerary(fresh);
        setData(fresh);
        setStatus('live');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ItineraryNotConfiguredError) setStatus('not-configured');
        else setStatus(loadCachedItinerary() ? 'offline' : 'unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, status };
}
