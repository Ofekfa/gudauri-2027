import { PageHeader } from '../components/PageHeader';
import type { NavItem } from '../navigation';

export function ComingSoonPage({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader title={item.title} />
      <div class="card empty-state">
        <p class="empty-state__emoji" aria-hidden="true">
          🏔️
        </p>
        <p>
          <strong>Coming soon.</strong> This part of the site is still being built. Check back
          before the trip!
        </p>
      </div>
    </>
  );
}
