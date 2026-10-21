import { TBC, type Airport, type FlightLeg } from '../data/trip';
import { formatDuration, formatInZone } from '../lib/time/format';
import { Icon } from './Icon';

interface FlightCardProps {
  label: string;
  leg: FlightLeg;
}

function Endpoint({ kind, airport, iso }: { kind: string; airport: Airport; iso: string }) {
  const local = iso === TBC ? null : formatInZone(iso, airport.timeZone);
  return (
    <div class="flight-endpoint">
      <span class="flight-endpoint__kind">{kind}</span>
      <span class="flight-endpoint__iata">{airport.iata}</span>
      <span class="flight-endpoint__airport">{airport.name}</span>
      {local ? (
        <>
          <span class="flight-endpoint__time">{local.time}</span>
          <span class="flight-endpoint__date">{local.date}</span>
          <span class="flight-endpoint__zone">
            {airport.zoneLabel} ({local.offset})
          </span>
        </>
      ) : (
        <>
          <span class="flight-endpoint__time flight-endpoint__time--tbc">TBC</span>
          <span class="flight-endpoint__date">Time to be confirmed</span>
        </>
      )}
    </div>
  );
}

export function FlightCard({ label, leg }: FlightCardProps) {
  const headingId = `flight-${leg.flightNo}`;
  const duration = leg.arrival === TBC ? null : formatDuration(leg.departure, leg.arrival);
  const { baggage } = leg;

  return (
    <article class="card flight-card" aria-labelledby={headingId}>
      <header class="flight-card__header">
        <h2 id={headingId}>
          <span class="flight-card__label">{label}</span>
          <span class="flight-card__number">
            {leg.carrier} {leg.flightNo}
          </span>
        </h2>
      </header>

      <div class="flight-route">
        <Endpoint kind="Departs" airport={leg.from} iso={leg.departure} />
        <div class="flight-route__line" aria-hidden="true">
          <Icon name="plane" size={22} />
          {duration && <span class="flight-route__duration">{duration}</span>}
        </div>
        <Endpoint kind="Arrives" airport={leg.to} iso={leg.arrival} />
      </div>
      {duration && <p class="visually-hidden">Flight time {duration}.</p>}

      {(baggage || leg.meal !== undefined) && (
        <div class="flight-extras">
          <h3>
            <Icon name="bag" size={18} /> Included per ticket
          </h3>
          <ul class="chips">
            {baggage?.trolleyKg !== undefined && <li>Trolley {baggage.trolleyKg} kg</li>}
            {baggage?.carryOnKg !== undefined && <li>Carry-on {baggage.carryOnKg} kg</li>}
            {baggage?.checkedKg !== undefined && <li>Checked bag {baggage.checkedKg} kg</li>}
            {leg.meal !== undefined && <li>Meal: {leg.meal ? 'yes' : 'no'}</li>}
          </ul>
        </div>
      )}
    </article>
  );
}
