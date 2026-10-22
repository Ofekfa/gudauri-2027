import type { ZoneId } from '../../data/zones';

export interface DayForecast {
  /** YYYY-MM-DD (Tbilisi). */
  date: string;
  minC: number;
  maxC: number;
  snowCm: number;
  windMaxKmh: number;
  /** WMO weather code. */
  code: number;
}

export interface ZoneWeather {
  id: ZoneId;
  elevationM: number;
  current: {
    tempC: number;
    windKmh: number;
    code: number;
    /** Local time, "YYYY-MM-DDTHH:MM" (Tbilisi). */ time: string;
  };
  /** Today and the next days. */
  days: DayForecast[];
  /** Most recent day (up to today) with meaningful snowfall, from the past days. */
  lastSnowfall: { date: string; cm: number } | null;
  /** Modeled snow depth at the current hour. Always an estimate, never a measurement. */
  snowDepthCm: number | null;
}

export interface WeatherPayload {
  source: 'open-meteo';
  fetchedAt: string;
  stale: boolean;
  zones: ZoneWeather[];
}
