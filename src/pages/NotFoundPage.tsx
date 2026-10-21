import { PageHeader } from '../components/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <div class="card empty-state">
        <p class="empty-state__emoji" aria-hidden="true">
          🧭
        </p>
        <p>Looks like you skied off-piste. Use the Back to Home link above to get back on track.</p>
      </div>
    </>
  );
}
