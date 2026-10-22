/**
 * Pure helpers for Open-Meteo forecast responses (shared by the Worker's
 * /weather route and the site). Upstream data is treated as untrusted.
 */
import type { Zone } from '../../data/zones';
import type { DayForecast, ZoneWeather } from './types';

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
export const PAST_DAYS = 30;
export const FORECAST_DAYS = 7;
/** Below this, a day's snowfall is noise rather than "it snowed". */
export const SNOWFALL_THRESHOLD_CM = 0.5;
const CM_PER_M = 100;

export function forecastUrl(zones: Zone[]): string {
  const params = new URLSearchParams({
    latitude: zones.map((z) => z.lat).join(','),
    longitude: zones.map((z) => z.lon).join(','),
    elevation: zones.map((z) => z.elevationM).join(','),
    current: 'temperature_2m,wind_speed_10m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,snowfall_sum,wind_speed_10m_max,weather_code',
    hourly: 'snow_depth',
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
    timezone: 'Asia/Tbilisi',
  });
  return `${OPEN_METEO_URL}?${params}`;
}

interface Location {
  elevation: number;
  current: { time: string; temperature_2m: number; wind_speed_10m: number; weather_code: number };
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    snowfall_sum: (number | null)[];
    wind_speed_10m_max: (number | null)[];
    weather_code: (number | null)[];
  };
  hourly: { time: string[]; snow_depth: (number | null)[] };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const numOrNullArray = (v: unknown, length: number) =>
  Array.isArray(v) && v.length === length && v.every((x) => x === null || num(x));

function validateLocation(raw: unknown): Location {
  if (!isRecord(raw) || !num(raw.elevation)) throw new Error('Bad location');
  const { current, daily, hourly } = raw;
  if (!isRecord(current) || typeof current.time !== 'string') throw new Error('Bad current');
  for (const k of ['temperature_2m', 'wind_speed_10m', 'weather_code']) {
    if (!num(current[k])) throw new Error(`Bad current.${k}`);
  }
  if (
    !isRecord(daily) ||
    !Array.isArray(daily.time) ||
    !daily.time.every((t) => typeof t === 'string')
  ) {
    throw new Error('Bad daily');
  }
  const n = daily.time.length;
  for (const k of [
    'temperature_2m_max',
    'temperature_2m_min',
    'snowfall_sum',
    'wind_speed_10m_max',
    'weather_code',
  ]) {
    if (!numOrNullArray(daily[k], n)) throw new Error(`Bad daily.${k}`);
  }
  if (
    !isRecord(hourly) ||
    !Array.isArray(hourly.time) ||
    !numOrNullArray(hourly.snow_depth, hourly.time.length)
  ) {
    throw new Error('Bad hourly');
  }
  return raw as unknown as Location;
}

/** Validates a multi-location response (an array, one entry per zone, in order). */
export function validateOpenMeteo(raw: unknown, expected: number): Location[] {
  const list = Array.isArray(raw) ? raw : [raw];
  if (list.length !== expected) throw new Error(`Expected ${expected} locations`);
  return list.map(validateLocation);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Latest day up to `today` whose snowfall reaches the threshold. */
export function lastSnowfall(
  dates: string[],
  snowfall: (number | null)[],
  today: string,
): { date: string; cm: number } | null {
  for (let i = dates.length - 1; i >= 0; i--) {
    const date = dates[i]!;
    const cm = snowfall[i] ?? 0;
    if (date <= today && cm >= SNOWFALL_THRESHOLD_CM) return { date, cm: round1(cm) };
  }
  return null;
}

/** Modeled snow depth (cm) at the hour of `localTime` ("YYYY-MM-DDTHH:MM"). */
export function snowDepthAt(
  times: string[],
  depthsM: (number | null)[],
  localTime: string,
): number | null {
  const hour = `${localTime.slice(0, 13)}:00`;
  const i = times.indexOf(hour);
  const value = i === -1 ? null : depthsM[i];
  return value === null || value === undefined ? null : Math.round(Math.max(0, value) * CM_PER_M);
}

export function summarizeZone(zone: Zone, loc: Location): ZoneWeather {
  const today = loc.current.time.slice(0, 10);
  const days: DayForecast[] = [];
  loc.daily.time.forEach((date, i) => {
    if (date < today) return;
    days.push({
      date,
      minC: round1(loc.daily.temperature_2m_min[i] ?? Number.NaN),
      maxC: round1(loc.daily.temperature_2m_max[i] ?? Number.NaN),
      snowCm: round1(loc.daily.snowfall_sum[i] ?? 0),
      windMaxKmh: Math.round(loc.daily.wind_speed_10m_max[i] ?? 0),
      code: loc.daily.weather_code[i] ?? 0,
    });
  });
  return {
    id: zone.id,
    elevationM: zone.elevationM,
    current: {
      tempC: round1(loc.current.temperature_2m),
      windKmh: Math.round(loc.current.wind_speed_10m),
      code: loc.current.weather_code,
      time: loc.current.time,
    },
    days: days.filter((d) => Number.isFinite(d.minC) && Number.isFinite(d.maxC)),
    lastSnowfall: lastSnowfall(loc.daily.time, loc.daily.snowfall_sum, today),
    snowDepthCm: snowDepthAt(loc.hourly.time, loc.hourly.snow_depth, loc.current.time),
  };
}
