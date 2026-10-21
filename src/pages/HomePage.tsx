import { PageHeader } from '../components/PageHeader';
import { SectionCards } from '../components/SectionCards';
import { trip } from '../data/trip';
import { SECTIONS } from '../navigation';

const travelerNames = (() => {
  const names = trip.travelers.map((t) => t.name);
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
})();

export function HomePage() {
  return (
    <>
      <PageHeader isHome title={trip.name} subtitle={travelerNames} />
      <section aria-labelledby="explore-title">
        <h2 id="explore-title" class="section-title">
          Explore
        </h2>
        <SectionCards items={SECTIONS} />
      </section>
    </>
  );
}
