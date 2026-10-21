import { PageHeader } from '../components/PageHeader';
import { SectionCards } from '../components/SectionCards';
import { MORE_ITEMS } from '../navigation';

export function MorePage() {
  return (
    <>
      <PageHeader title="More" subtitle="Everything else on the site." />
      <SectionCards items={MORE_ITEMS} />
    </>
  );
}
