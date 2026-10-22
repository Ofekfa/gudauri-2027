import { describe, expect, it } from 'vitest';
import { elevationToY, GRAPHIC, snowBlanketPx } from './graphic';
import { fetchWeather, loadCachedWeather, saveCachedWeather } from './weatherClient';
import { createMemoryStore } from '../storage/safeStorage';
import { vi } from 'vitest';

describe('mountain graphic geometry', () => {
  it('maps elevation to y with higher meaning further up', () => {
    expect(elevationToY(GRAPHIC.minElevationM)).toBe(GRAPHIC.bottomY);
    expect(elevationToY(GRAPHIC.maxElevationM)).toBe(GRAPHIC.topY);
    expect(elevationToY(2950)).toBeLessThan(elevationToY(2700));
    // Zones stay far enough apart for their labels.
    expect(elevationToY(2700) - elevationToY(2950)).toBeGreaterThanOrEqual(36);
  });

  it('scales the snow blanket with depth, capped, and draws nothing without snow', () => {
    expect(snowBlanketPx(0)).toBe(0);
    expect(snowBlanketPx(null)).toBe(0);
    expect(snowBlanketPx(1)).toBe(2);
    expect(snowBlanketPx(45)).toBe(15);
    expect(snowBlanketPx(400)).toBe(GRAPHIC.maxSnowPx);
  });
});

describe('weather client', () => {
  const payload = {
    source: 'open-meteo',
    fetchedAt: '2027-02-26T06:00:00.000Z',
    stale: false,
    zones: [
      {
        id: 'top',
        elevationM: 2950,
        current: { tempC: -6, windKmh: 20, code: 73, time: '2027-02-26T10:15' },
        days: [{ date: '2027-02-26', minC: -9, maxC: -4, snowCm: 5, windMaxKmh: 30, code: 73 }],
        lastSnowfall: { date: '2027-02-26', cm: 5 },
        snowDepthCm: 120,
      },
    ],
  } as const;

  it('fetches, validates and keeps an offline copy', async () => {
    const ok = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
    const data = await fetchWeather('https://w', ok);
    expect(data.zones[0]!.snowDepthCm).toBe(120);
    const store = createMemoryStore();
    expect(loadCachedWeather(store)).toBeNull();
    saveCachedWeather(data, store);
    expect(loadCachedWeather(store)).toEqual(data);
    const down = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(fetchWeather('https://w', down)).rejects.toThrow(/503/);
  });
});
