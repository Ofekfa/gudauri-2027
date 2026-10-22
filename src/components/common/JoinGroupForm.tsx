import { useState } from 'preact/hooks';
import { trip, type TravelerId } from '../../data/trip';
import { syncSettings } from '../../lib/sync/settings';

/**
 * Group code + whose phone this is. Joining once unlocks shared lists and
 * adding to the album; the code stays on this phone.
 */
export function JoinGroupForm({
  idPrefix,
  initialMe,
}: {
  idPrefix: string;
  initialMe: TravelerId | null;
}) {
  const [code, setCode] = useState('');
  const [me, setMe] = useState<TravelerId | null>(initialMe);
  const codeId = `${idPrefix}-code`;

  return (
    <form
      class="sync-panel__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim() && me) syncSettings.join(code, me);
      }}
    >
      <label class="sync-panel__field" htmlFor={codeId}>
        Group code
        <input
          id={codeId}
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
}
