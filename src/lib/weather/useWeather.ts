import { useEffect, useState } from 'preact/hooks';
import type { WeatherPayload } from './types';
import { fetchWeather, loadCachedWeather, saveCachedWeather } from './weatherClient';

export type WeatherStatus = 'loading' | 'live' | 'offline' | 'unavailable';

/** Shows the last saved weather immediately, then refreshes from the Worker. */
export function useWeather(): { data: WeatherPayload | null; status: WeatherStatus } {
  const [data, setData] = useState<WeatherPayload | null>(() => loadCachedWeather());
  const [status, setStatus] = useState<WeatherStatus>('loading');
  useEffect(() => {
    let cancelled = false;
    fetchWeather()
      .then((fresh) => {
        if (cancelled) return;
        saveCachedWeather(fresh);
        setData(fresh);
        setStatus('live');
      })
      .catch(() => {
        if (!cancelled) setStatus(loadCachedWeather() ? 'offline' : 'unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, status };
}
