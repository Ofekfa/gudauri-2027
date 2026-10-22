/**
 * A compact "live data" block for the assistant's system prompt: exchange
 * rates, weather per zone and the plan for today and tomorrow. Reads the same
 * cache as the /rates, /weather and /itinerary routes; a slow or failing
 * source is simply left out.
 */
import { ZONES } from '../../src/data/zones';
import { trip } from '../../src/data/trip';
import type { Rates } from '../../src/lib/currency/rates';
import { groupByDay, mergeEntries } from '../../src/lib/itinerary/plan';
import type { ItineraryEvent } from '../../src/lib/itinerary/types';
import { getTripPhase, localDateIn } from '../../src/lib/time/countdown';
import type { ZoneWeather } from '../../src/lib/weather/types';
import type { CachedResult } from './cache';
import type { Env } from './env';
import { LIVE_CONTEXT_MAX_CHARS, LIVE_SOURCE_TIMEOUT_MS, LIVE_TEXT_MAX_CHARS } from './limits';
import { loadItinerary } from './routes/itinerary';
import { loadRates } from './routes/rates';
import { loadWeather } from './routes/weather';

const TZ = trip.destinationTimeZone;
const DAY_MS = 86_400_000;
const RATE_DECIMALS = 3;

export interface LiveSources {
  rates: () => Promise<CachedResult<Rates>>;
  weather: () => Promise<CachedResult<ZoneWeather[]>>;
  itinerary: () => Promise<CachedResult<ItineraryEvent[]>>;
}

export const sourcesFor = (env: Env): LiveSources => ({
  rates: () => loadRates(env),
  weather: () => loadWeather(env),
  itinerary: () =>
    env.CALENDAR_ICS_URL ? loadItinerary(env) : Promise.reject(new Error('not configured')),
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

const tbilisiTime = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ms);

const dayName = (day: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(Date.parse(`${day}T00:00:00Z`));

const shiftDay = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Calendar text is data: one line, no control characters, length-capped. */
export function cleanText(text: string): string {
  const flat = text
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > LIVE_TEXT_MAX_CHARS ? `${flat.slice(0, LIVE_TEXT_MAX_CHARS - 1)}…` : flat;
}

const staleNote = (r: CachedResult<unknown>) => (r.stale ? ', may be out of date' : '');

export function ratesLines(r: CachedResult<Rates>): string[] {
  const { ILS, EUR } = r.data.gelPer;
  return [
    `Exchange rates (${r.data.source === 'nbg' ? 'National Bank of Georgia' : 'ExchangeRate-API'}, valid ${r.data.validFrom}${staleNote(r)}): 1 ILS = ${ILS.toFixed(RATE_DECIMALS)} GEL; 1 EUR = ${EUR.toFixed(RATE_DECIMALS)} GEL; 1 GEL = ${(1 / ILS).toFixed(2)} ILS.`,
  ];
}

export function weatherLines(r: CachedResult<ZoneWeather[]>): string[] {
  const lines = [
    `Weather (Open-Meteo, as of ${tbilisiTime(r.fetchedAt)} Tbilisi time${staleNote(r)}; snow depth is a model estimate):`,
  ];
  const range = (d: ZoneWeather['days'][number] | undefined, label: string) =>
    d ? ` ${label} ${Math.round(d.minC)}..${Math.round(d.maxC)}°C, new snow ${d.snowCm} cm.` : '';
  for (const w of r.data) {
    const zone = ZONES.find((z) => z.id === w.id);
    if (!zone) continue;
    const depth = w.snowDepthCm === null ? 'unknown' : `~${w.snowDepthCm} cm`;
    const last = w.lastSnowfall
      ? `${w.lastSnowfall.date} (${w.lastSnowfall.cm} cm)`
      : 'none in 30 days';
    lines.push(
      `- ${zone.name} ${zone.elevationM} m: now ${Math.round(w.current.tempC)}°C, wind ${w.current.windKmh} km/h.${range(w.days[0], 'Today')}${range(w.days[1], 'Tomorrow')} Depth ${depth}; last snow ${last}.`,
    );
  }
  return lines;
}

/** Plan lines for today and tomorrow (Tbilisi); before the trip, the first two trip days. */
export function itineraryLines(r: CachedResult<ItineraryEvent[]>, nowMs: number): string[] {
  const today = localDateIn(nowMs, TZ);
  const first = today < trip.firstDay ? trip.firstDay : today;
  const days = [first, shiftDay(first, 1)].filter((d) => d <= shiftDay(trip.lastDay, 1));
  if (days.length === 0) return [];
  const groups = groupByDay(mergeEntries(trip, r.data), days, TZ);
  const lines = [`Our plan from the shared calendar (Tbilisi times${staleNote(r)}):`];
  for (const day of days) {
    const entries = groups.get(day) ?? [];
    const label =
      day === today
        ? `Today, ${dayName(day)}`
        : day === shiftDay(today, 1)
          ? `Tomorrow, ${dayName(day)}`
          : dayName(day);
    const items = entries.map((e) => {
      const time = e.allDay
        ? 'all day'
        : new Intl.DateTimeFormat('en-GB', {
            timeZone: TZ,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(Date.parse(e.start));
      return `${time} ${cleanText(e.title)}${e.location ? ` (${cleanText(e.location)})` : ''}`;
    });
    lines.push(`- ${label}: ${items.length ? items.join('; ') : 'nothing planned'}.`);
  }
  return lines;
}

/** Joins sections in priority order, dropping whole lines that would exceed the budget. */
export function fitToBudget(sections: string[][], max = LIVE_CONTEXT_MAX_CHARS): string {
  const out: string[] = [];
  let used = 0;
  for (const lines of sections) {
    for (const line of lines) {
      const room = max - used - (out.length ? 1 : 0);
      if (line.length <= room) {
        out.push(line);
        used += line.length + (out.length > 1 ? 1 : 0);
      } else if (room > 20) {
        // A long plan line is cut rather than dropped: the start of the day matters most.
        out.push(`${line.slice(0, room - 1)}…`);
        used = max;
      }
    }
  }
  return out.join('\n');
}

/** The live block, or '' when no source is available. Never throws. */
export async function buildLiveContext(sources: LiveSources, now: Date): Promise<string> {
  const [rates, weather, itinerary] = await Promise.allSettled([
    withTimeout(sources.rates(), LIVE_SOURCE_TIMEOUT_MS),
    withTimeout(sources.weather(), LIVE_SOURCE_TIMEOUT_MS),
    withTimeout(sources.itinerary(), LIVE_SOURCE_TIMEOUT_MS),
  ]);
  const plan =
    itinerary.status === 'fulfilled' ? itineraryLines(itinerary.value, now.getTime()) : [];
  const forecast = weather.status === 'fulfilled' ? weatherLines(weather.value) : [];
  const money = rates.status === 'fulfilled' ? ratesLines(rates.value) : [];
  // During the trip the plan matters most; before it, weather and rates are what people ask about.
  const during = getTripPhase(now.getTime(), trip).kind === 'during';
  const sections = during ? [plan, forecast, money] : [money, forecast, plan];
  return fitToBudget(sections.filter((lines) => lines.length));
}
