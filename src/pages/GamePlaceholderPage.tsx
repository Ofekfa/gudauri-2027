import { Crew } from '../components/Crew';
import { PageHeader } from '../components/PageHeader';

/** Temporary until the game lands (Phase 5): introduces the four skiers. */
export function GamePlaceholderPage() {
  return (
    <>
      <PageHeader title="Ski game" subtitle="Pick your skier: the race opens soon." />
      <Crew skiing />
      <div class="card empty-state" style={{ marginTop: 'var(--space-4)' }}>
        <p>
          <strong>Coming soon.</strong> Dodge trees, rocks and flags, grab khachapuri, and beat each
          other’s high scores.
        </p>
      </div>
    </>
  );
}
