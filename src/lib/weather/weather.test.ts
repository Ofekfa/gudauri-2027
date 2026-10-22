import { describe, expect, it } from 'vitest';
import { ZONES } from '../../data/zones';
import { describeWeather, snowIntensity } from './codes';
import {
  forecastUrl,
  lastSnowfall,
  PAST_DAYS,
  snowDepthAt,
  summarizeZone,
  validateOpenMeteo,
} from './openMeteo';
import { validateWeatherPayload } from './validate';

/** Builds a response shaped exactly like Open-Meteo's (checked against a live call). */
function location(overrides: { snow?: number[]; depthM?: number; elevation?: number } = {}) {
  const dates = Array.from({ length: PAST_DAYS + 7 }, (_, i) =>
    new Date(Date.parse('2027-01-27T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10),
  );
  const snow = dates.map((_, i) => overrides.snow?.[i] ?? 0);
  const hours = dates.flatMap((d) =>
    Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`),
  );
  return {
    latitude: 42.44,
    longitude: 44.46,
    elevation: overrides.elevation ?? 2000,
    timezone: 'Asia/Tbilisi',
    current: {
      time: '2027-02-26T10:15',
      interval: 900,
      temperature_2m: -4.26,
      wind_speed_10m: 12.4,
      weather_code: 73,
    },
    daily: {
      time: dates,
      temperature_2m_max: dates.map(() => -2),
      temperature_2m_min: dates.map(() => -9.04),
      snowfall_sum: snow,
      wind_speed_10m_max: dates.map(() => 25.2),
      weather_code: dates.map(() => 71),
    },
    hourly: { time: hours, snow_depth: hours.map(() => overrides.depthM ?? 0.853) },
  };
}

describe('forecastUrl', () => {
  it('asks for all zones in one call with their elevations', () => {
    const url = new URL(forecastUrl(ZONES));
    expect(url.searchParams.get('elevation')).toBe('2000,2700,2950');
    expect(url.searchParams.get('latitude')?.split(',')).toHaveLength(3);
    expect(url.searchParams.get('hourly')).toBe('snow_depth');
    expect(url.searchParams.get('timezone')).toBe('Asia/Tbilisi');
  });
});

describe('validateOpenMeteo', () => {
  it('accepts a well-formed multi-location response', () => {
    expect(validateOpenMeteo([location(), location(), location()], 3)).toHaveLength(3);
  });

  it('rejects wrong counts and malformed data', () => {
    expect(() => validateOpenMeteo([location()], 3)).toThrow();
    const broken = location();
    (broken.daily.snowfall_sum as unknown[]) = ['lots'];
    expect(() => validateOpenMeteo([broken, location(), location()], 3)).toThrow();
    expect(() => validateOpenMeteo({ error: true, reason: 'nope' }, 3)).toThrow();
  });
});

describe('snow helpers', () => {
  it('finds the most recent snowfall up to today, ignoring traces and the future', () => {
    const dates = ['2027-02-20', '2027-02-23', '2027-02-25', '2027-02-26', '2027-02-27'];
    expect(lastSnowfall(dates, [10, 4.04, 0.2, 0, 30], '2027-02-26')).toEqual({
      date: '2027-02-23',
      cm: 4,
    });
    expect(lastSnowfall(dates, [0, 0, 0, 0, 30], '2027-02-26')).toBeNull();
  });

  it('reads modeled depth at the current hour, in cm', () => {
    const times = ['2027-02-26T09:00', '2027-02-26T10:00'];
    expect(snowDepthAt(times, [0.5, 0.853], '2027-02-26T10:15')).toBe(85);
    expect(snowDepthAt(times, [0.5, null], '2027-02-26T10:15')).toBeNull();
    expect(snowDepthAt(times, [0.5, 0.8], '2027-03-01T10:00')).toBeNull();
  });
});

describe('summarizeZone', () => {
  it('builds a compact per-zone summary from today onward', () => {
    const snow = Array.from({ length: PAST_DAYS + 7 }, () => 0);
    snow[PAST_DAYS - 3] = 14.04; // 2027-02-23
    const z = summarizeZone(ZONES[2]!, validateOpenMeteo([location({ snow })], 1)[0]!);
    expect(z.id).toBe('top');
    expect(z.current).toEqual({ tempC: -4.3, windKmh: 12, code: 73, time: '2027-02-26T10:15' });
    expect(z.days[0]).toEqual({
      date: '2027-02-26',
      minC: -9,
      maxC: -2,
      snowCm: 0,
      windMaxKmh: 25,
      code: 71,
    });
    expect(z.days.every((d) => d.date >= '2027-02-26')).toBe(true);
    expect(z.lastSnowfall).toEqual({ date: '2027-02-23', cm: 14 });
    expect(z.snowDepthCm).toBe(85);
  });

  it('treats a snow-free off-season as valid data', () => {
    const z = summarizeZone(ZONES[0]!, validateOpenMeteo([location({ depthM: 0 })], 1)[0]!);
    expect(z.snowDepthCm).toBe(0);
    expect(z.lastSnowfall).toBeNull();
  });
});

describe('codes and payload validation', () => {
  it('maps WMO codes to labels', () => {
    expect(describeWeather(73)).toEqual({ label: 'Snow', emoji: '🌨️' });
    expect(describeWeather(0).label).toBe('Clear');
    expect(describeWeather(1234).label).toBe('Unknown');
    expect(snowIntensity(75)).toBe('heavy');
    expect(snowIntensity(3)).toBeNull();
  });

  it('validates the Worker payload, dropping malformed zones', () => {
    const zone = summarizeZone(ZONES[0]!, validateOpenMeteo([location()], 1)[0]!);
    const payload = {
      source: 'open-meteo',
      fetchedAt: '2027-02-26T06:20:00.000Z',
      stale: false,
      zones: [zone, { id: 'nope' }],
    };
    expect(validateWeatherPayload(payload).zones).toEqual([zone]);
    expect(() => validateWeatherPayload({ ...payload, zones: [] })).toThrow();
    expect(() => validateWeatherPayload({ ...payload, source: 'other' })).toThrow();
  });
});
