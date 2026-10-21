import { Countdown } from '../components/Countdown';
import { Crew } from '../components/Crew';
import { PageHeader } from '../components/PageHeader';
import { SectionCards } from '../components/SectionCards';
import { trip } from '../data/trip';
import { formatDayRange } from '../lib/time/format';
import { SECTIONS } from '../navigation';

const travelerNames = (() => {
  const names = trip.travelers.map((t) => t.name);
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
})();

export function HomePage() {
  return (
    <>
      <PageHeader
        isHome
        title={trip.name}
        subtitle={`${formatDayRange(trip.firstDay, trip.lastDay)} · ${travelerNames}`}
      />
      <Countdown />
      <section aria-labelledby="crew-title">
        <h2 id="crew-title" class="section-title">
          The crew
        </h2>
        <Crew />
      </section>
      <section aria-labelledby="explore-title">
        <h2 id="explore-title" class="section-title">
          Explore
        </h2>
        <SectionCards items={SECTIONS} />
      </section>
    </>
  );
}
