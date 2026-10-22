import { useEffect, useState } from 'preact/hooks';
import { trip, type TravelerId } from '../../data/trip';
import { isJoined, syncSettings } from '../../lib/sync/settings';
import type { ListSyncView } from '../../lib/sync/useListSync';
import { formatAgo } from '../../lib/time/format';
import { WORKER_URL } from '../../lib/worker/config';

const REFRESH_LABEL_MS = 15_000;

function statusText(view: ListSyncView, now: number): string {
  switch (view.status) {
    case 'synced':
      return `Synced with the group${view.lastSyncedAt ? ` · ${formatAgo(view.lastSyncedAt, now)}` : ''}`;
    case 'syncing':
      return 'Syncing…';
    case 'offline':
      return 'Offline: your changes are saved here and will sync when you’re back online.';
    case 'wrong-code':
      return 'That group code didn’t work. Check it and join again.';
    case 'not-set-up':
      return 'Sync isn’t set up yet (Ofek needs to add the group code).';
    case 'error':
      return 'Sync hit a snag; it will retry shortly.';
    default:
      return 'Connecting…';
  }
}

/**
 * Join the group (code + whose phone this is), then a one-line status.
 * The code stays on this phone; lists sync through our Worker.
 */
export function SyncPanel({ view, what }: { view: ListSyncView; what: string }) {
  const [now, setNow] = useState(Date.now());
  const [code, setCode] = useState('');
  const [me, setMe] = useState<TravelerId | null>(view.settings.me);
  const joined = isJoined(view.settings);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_LABEL_MS);
    return () => clearInterval(timer);
  }, []);

  if (!WORKER_URL) return null;

  const form = (
    <form
      class="sync-panel__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim() && me) syncSettings.join(code, me);
      }}
    >
      <label class="sync-panel__field" htmlFor="sync-code">
        Group code
        <input
          id="sync-code"
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          spellcheck={false}
          value={code}
          onInput={(e) => setCode(e.currentTarget.value)}
        />
      </label>
      <fieldset class="sync-panel__who">
        <legend>Whose phone is this?</legend>
        <div class="filters__group">
          {trip.travelers.map((t) => (
            <button
              key={t.id}
              type="button"
              class="chip-button chip-button--small"
              aria-pressed={me === t.id}
              onClick={() => setMe(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </fieldset>
      <button type="submit" class="button button--primary" disabled={!code.trim() || !me}>
        Join
      </button>
    </form>
  );

  if (!joined) {
    return (
      <details class="sync-panel card">
        <summary class="sync-panel__summary">
          <span aria-hidden="true">🔄</span> Share {what} with Ron, Roy &amp; Maya
        </summary>
        <p class="sync-panel__intro">
          Everyone sees and edits the same {what}, on every phone. What’s on this phone now is
          merged in; nothing is lost. Ask Ofek for the group code.
        </p>
        {form}
      </details>
    );
  }

  return (
    <section class="sync-panel sync-panel--joined card" aria-label="Sharing">
      <p class={`sync-panel__status sync-panel__status--${view.status}`} role="status">
        <span aria-hidden="true">🔄</span> {statusText(view, now)}{' '}
        <button type="button" class="link-button" onClick={() => syncSettings.leave()}>
          Stop sharing on this phone
        </button>
      </p>
      {view.status === 'wrong-code' && form}
    </section>
  );
}
