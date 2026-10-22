import { useState } from 'preact/hooks';
import { PageHeader } from '../components/PageHeader';
import { MountainZones } from '../components/weather/MountainZones';
import { WebcamCard } from '../components/weather/WebcamCard';
import { ZONES, type ZoneId } from '../data/zones';
import { describeWeather } from '../lib/weather/codes';
import type { ZoneWeather } from '../lib/weather/types';
import { useWeather } from '../lib/weather/useWeather';
import { formatAgo, formatDay } from '../lib/time/format';

/** "Thu" for a YYYY-MM-DD day. */
const weekday = (day: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(
    Date.parse(`${day}T00:00:00Z`),
  );

function ZoneDetails({ weather }: { weather: ZoneWeather }) {
  const now = describeWeather(weather.current.code);
  return (
    <div class="zone-details">
      <p class="zone-now">
        <span class="zone-now__temp">
          <span aria-hidden="true">{now.emoji} </span>
          {Math.round(weather.current.tempC)}°C
        </span>
        <span class="zone-now__meta">
          {now.label} · wind {weather.current.windKmh} km/h
        </span>
      </p>
      <dl class="zone-facts">
        <div>
          <dt>Snow depth</dt>
          <dd>
            {weather.snowDepthCm === null ? 'Unknown' : `≈ ${weather.snowDepthCm} cm`}{' '}
            <span class="zone-facts__note">estimated (model)</span>
          </dd>
        </div>
        <div>
          <dt>Last snowfall</dt>
          <dd>
            {weather.lastSnowfall
              ? `${formatDay(weather.lastSnowfall.date)} · ${weather.lastSnowfall.cm} cm`
              : 'None in the last 30 days'}
          </dd>
        </div>
      </dl>
      <ol class="forecast" aria-label="7-day forecast">
        {weather.days.map((d) => {
          const w = describeWeather(d.code);
          return (
            <li key={d.date} class="forecast__day">
              <span class="forecast__name">{weekday(d.date)}</span>
              <span class="forecast__icon" role="img" aria-label={w.label}>
                {w.emoji}
              </span>
              <span class="forecast__max">{Math.round(d.maxC)}°</span>
              <span class="forecast__min">{Math.round(d.minC)}°</span>
              <span class="forecast__snow">
                {d.snowCm > 0 ? (
                  <>
                    {d.snowCm}
                    <span class="visually-hidden"> cm of snow</span>
                    <span aria-hidden="true"> cm</span>
                  </>
                ) : (
                  <span aria-label="no snow">–</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function WeatherPage() {
  const { data, status } = useWeather();
  const [selected, setSelected] = useState<ZoneId>('base');
  const zone = ZONES.find((z) => z.id === selected)!;
  const weather = data?.zones.find((z) => z.id === selected);
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Weather & snow"
        subtitle="Forecast, snow and live cams at three altitudes."
      />

      {!data ? (
        status === 'loading' ? (
          <p class="page-loading" role="status">
            Loading the forecast…
          </p>
        ) : (
          <p class="card" role="alert">
            Couldn’t load the weather. Check your connection and try again.
          </p>
        )
      ) : (
        <>
          {(status === 'offline' || data.stale) && (
            <p class="note note--warning" role="status">
              {status === 'offline'
                ? `Offline: showing the forecast saved on this phone (updated ${formatAgo(Date.parse(data.fetchedAt), now)}).`
                : 'The weather service didn’t respond just now; this is the latest forecast we have.'}
            </p>
          )}

          <section class="card mountain-card" aria-label="Conditions by altitude">
            <MountainZones zones={data.zones} selected={selected} />
          </section>

          <div class="zone-tabs" role="group" aria-label="Choose an altitude">
            {ZONES.map((z) => (
              <button
                key={z.id}
                type="button"
                class="chip-button zone-tabs__button"
                aria-pressed={selected === z.id}
                onClick={() => setSelected(z.id)}
              >
                {z.name}
                <span class="zone-tabs__elevation">{z.elevationM.toLocaleString('en')} m</span>
              </button>
            ))}
          </div>

          <section class="card zone-card" aria-labelledby="zone-title">
            <h2 id="zone-title" class="zone-card__title">
              {zone.name} · {zone.elevationM.toLocaleString('en')} m
            </h2>
            <p class="zone-card__place">{zone.place}</p>
            {weather ? (
              <ZoneDetails weather={weather} />
            ) : (
              <p>No data for this altitude right now.</p>
            )}
          </section>

          <section aria-labelledby="cams-title">
            <h2 id="cams-title" class="section-title">
              Live cam
            </h2>
            {zone.webcam ? (
              <WebcamCard key={zone.webcam.id} cam={zone.webcam} zoneName={zone.name} />
            ) : (
              <p class="note">{zone.webcamNote}</p>
            )}
          </section>

          <p class="rates-meta">
            Updated {formatAgo(Date.parse(data.fetchedAt), now)} ·{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
              Weather data by Open-Meteo.com
            </a>{' '}
            (CC BY 4.0). Snow depth comes from weather models and is an estimate, not a measurement.
            Check the resort for official snow reports.
          </p>
        </>
      )}
    </>
  );
}
