import { useState } from 'preact/hooks';
import { ALBUM_FRAMES, findFrame } from '../../data/album';
import { photosByFrame, suggestFrame } from '../../lib/album/selectors';
import { visiblePhotos } from '../../lib/album/service';
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
  const suggested = suggestFrame(Date.now(), photosByFrame(visiblePhotos(album)));
  const frame = findFrame(chosen ?? suggested) ?? ALBUM_FRAMES[0]!;

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
              {ALBUM_FRAMES.map((f) => (
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
