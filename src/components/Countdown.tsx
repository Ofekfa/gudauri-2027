import { trip } from '../data/trip';
import { getTripPhase, splitDuration, type DurationParts } from '../lib/time/countdown';
import { formatInZone } from '../lib/time/format';
import { useNow } from '../lib/time/useNow';
import { href } from '../lib/router/hashRouter';

const UNITS: { key: keyof DurationParts; label: string }[] = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'seconds', label: 'Seconds' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Countdown() {
  const now = useNow();
  const phase = getTripPhase(now, trip);

  if (phase.kind === 'during') {
    return (
      <section class="countdown countdown--during" aria-labelledby="countdown-title">
        <p class="countdown__eyebrow">Right now</p>
        <h2 id="countdown-title" class="countdown__headline">
          We’re in Gudauri!
        </h2>
        <p class="countdown__day">
          Day {phase.day} of {phase.totalDays}
        </p>
        <ol class="day-dots" aria-hidden="true">
          {Array.from({ length: phase.totalDays }, (_, i) => (
            <li key={i} class={i < phase.day ? 'is-done' : undefined} />
          ))}
        </ol>
      </section>
    );
  }

  if (phase.kind === 'after') {
    return (
      <section class="countdown countdown--after" aria-labelledby="countdown-title">
        <h2 id="countdown-title" class="countdown__headline">
          Welcome home!
        </h2>
        <p>
          Gudauri 2027 is a wrap. Beat your best score in the <a href={href('/game')}>ski game</a>{' '}
          while you plan the next one.
        </p>
      </section>
    );
  }

  const parts = splitDuration(phase.remainingMs);
  const takeoff = formatInZone(trip.outbound.departure, trip.outbound.from.timeZone);
  // Updates once a minute, so screen readers aren't flooded every second.
  const summary = `${plural(parts.days, 'day')}, ${plural(parts.hours, 'hour')} and ${plural(parts.minutes, 'minute')} until takeoff.`;

  return (
    <section class="countdown" aria-labelledby="countdown-title">
      <h2 id="countdown-title" class="countdown__eyebrow">
        Countdown to takeoff
      </h2>
      <div class="countdown__grid" aria-hidden="true">
        {UNITS.map(({ key, label }) => (
          <div class="countdown__unit" key={key}>
            <span class="countdown__value">{key === 'days' ? parts[key] : pad(parts[key])}</span>
            <span class="countdown__label">{label}</span>
          </div>
        ))}
      </div>
      <p class="visually-hidden" aria-live="polite">
        {summary}
      </p>
      <p class="countdown__meta">
        {trip.outbound.flightNo} departs {trip.outbound.from.city} on {takeoff.date} at{' '}
        <strong>{takeoff.time}</strong> ({trip.outbound.from.zoneLabel}, {takeoff.offset})
      </p>
    </section>
  );
}
