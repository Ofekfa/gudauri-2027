import { syncSettings } from '../../lib/sync/settings';
import { JoinGroupForm } from '../common/JoinGroupForm';

/** Shown instead of the add buttons until this phone has joined the group. */
export function AlbumJoin() {
  return (
    <details class="sync-panel card">
      <summary class="sync-panel__summary">
        <span aria-hidden="true">🔑</span> Join to add photos
      </summary>
      <p class="sync-panel__intro">
        Anyone with the site can look; adding, captions and deleting need the group code (the same
        one as for shared lists). Ask Ofek for it.
      </p>
      <JoinGroupForm idPrefix="album" initialMe={syncSettings.get().me} />
    </details>
  );
}
