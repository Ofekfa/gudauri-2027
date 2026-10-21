import { FlightCard } from '../components/FlightCard';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { trip } from '../data/trip';

export function FlightsPage() {
  return (
    <>
      <PageHeader title="Flights" subtitle="Tel Aviv ⇄ Tbilisi with El Al" />
      <p class="note">
        <Icon name="clock" size={18} />
        Times shown in the local time of each airport.
      </p>
      <div class="stack">
        <FlightCard label="Outbound" leg={trip.outbound} />
        <FlightCard label="Return" leg={trip.inbound} />
      </div>
    </>
  );
}
