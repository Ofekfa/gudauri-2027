import { PageHeader } from '../components/PageHeader';
import { SectionCards } from '../components/SectionCards';
import { MORE_GROUPS } from '../navigation';

export function MorePage() {
  return (
    <>
      <PageHeader title="More" subtitle="Everything else on the site." />
      {MORE_GROUPS.map(({ group, label, items }) => (
        <section key={group} aria-labelledby={`more-${group}`}>
          <h2 id={`more-${group}`} class="section-title">
            {label}
          </h2>
          <SectionCards items={items} />
        </section>
      ))}
    </>
  );
}
