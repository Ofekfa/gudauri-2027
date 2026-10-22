import { useState } from 'preact/hooks';
import { photosByFrame, suggestFrame } from '../../lib/album/selectors';
import { isPendingMoment, momentsOf, visiblePhotos } from '../../lib/album/service';
import { useAlbum } from '../../lib/album/useAlbum';
import { href } from '../../lib/router/hashRouter';
import { isJoined } from '../../lib/sync/settings';
import { useSyncSettings } from '../../lib/sync/useSyncSettings';
import { AddPhotoButtons } from './AddPhotoButtons';

/** Home card during the trip: snap a photo into the right moment without leaving Home. */
export default function QuickAdd() {
  const album = useAlbum();
  const settings = useSyncSettings();
  const [chosen, setChosen] = useState<string | null>(null);
  const moments = momentsOf(album).filter((m) => !isPendingMoment(m.id));
  const suggested = suggestFrame(Date.now(), photosByFrame(visiblePhotos(album), moments), moments);
  const frame = moments.find((m) => m.id === (chosen ?? suggested)) ?? moments[0]!;

  return (
    <section class="quick-add card" aria-labelledby="quick-add-title">
      <h2 id="quick-add-title" class="quick-add__title">
        <span aria-hidden="true">📷</span> Quick add to the album
      </h2>
      {isJoined(settings) ? (
        <>
          <label class="quick-add__field" htmlFor="quick-add-frame">
            Moment
            <select
              id="quick-add-frame"
              value={frame.id}
              onChange={(e) => setChosen(e.currentTarget.value)}
            >
              {moments.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji} {f.title}
                </option>
              ))}
            </select>
          </label>
          <AddPhotoButtons frameId={frame.id} frameTitle={frame.title} />
        </>
      ) : (
        <p class="quick-add__join">
          <a href={href('/album')}>Join on the album page</a> to add photos.
        </p>
      )}
    </section>
  );
}
