import type { ZoneId } from '../../data/zones';
import type { WeatherPayload, ZoneWeather } from './types';

const ZONE_IDS: ZoneId[] = ['base', 'mid', 'top'];
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validZone(raw: unknown): ZoneWeather | null {
  if (!isRecord(raw) || !ZONE_IDS.includes(raw.id as ZoneId) || !num(raw.elevationM)) return null;
  const c = raw.current;
  if (
    !isRecord(c) ||
    !num(c.tempC) ||
    !num(c.windKmh) ||
    !num(c.code) ||
    typeof c.time !== 'string'
  )
    return null;
  if (!Array.isArray(raw.days)) return null;
  const days = raw.days.filter(
    (d): d is ZoneWeather['days'][number] =>
      isRecord(d) &&
      typeof d.date === 'string' &&
      num(d.minC) &&
      num(d.maxC) &&
      num(d.snowCm) &&
      num(d.windMaxKmh) &&
      num(d.code),
  );
  const ls = raw.lastSnowfall;
  const lastSnowfall =
    isRecord(ls) && typeof ls.date === 'string' && num(ls.cm) ? { date: ls.date, cm: ls.cm } : null;
  return {
    id: raw.id as ZoneId,
    elevationM: raw.elevationM,
    current: { tempC: c.tempC, windKmh: c.windKmh, code: c.code, time: c.time },
    days,
    lastSnowfall,
    snowDepthCm: num(raw.snowDepthCm) ? raw.snowDepthCm : null,
  };
}

/** Validates the Worker's /weather payload (or a saved copy). */
export function validateWeatherPayload(raw: unknown): WeatherPayload {
  if (
    !isRecord(raw) ||
    raw.source !== 'open-meteo' ||
    typeof raw.fetchedAt !== 'string' ||
    !Array.isArray(raw.zones)
  ) {
    throw new Error('Bad weather payload');
  }
  const zones = raw.zones.map(validZone).filter((z): z is ZoneWeather => z !== null);
  if (zones.length === 0) throw new Error('No usable weather zones');
  return { source: 'open-meteo', fetchedAt: raw.fetchedAt, stale: raw.stale === true, zones };
}
