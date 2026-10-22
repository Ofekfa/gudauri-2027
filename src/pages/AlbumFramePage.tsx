import { useEffect, useRef, useState } from 'preact/hooks';
import type { ParamPageProps } from '../app';
import { AddPhotoButtons } from '../components/album/AddPhotoButtons';
import { AlbumJoin } from '../components/album/AlbumJoin';
import { PageHeader } from '../components/PageHeader';
import { AvatarFace } from '../avatars/Avatar';
import { findFrame, MAX_CAPTION_CHARS } from '../data/album';
import { trip } from '../data/trip';
import { coverFor, photosByFrame, viewerIndex } from '../lib/album/selectors';
import {
  deletePhoto,
  editCaption,
  imageUrl,
  makeCover,
  retryUpload,
  visiblePhotos,
} from '../lib/album/service';
import { useAlbum } from '../lib/album/useAlbum';
import { useCarousel } from '../components/album/useCarousel';
import { wrapIndex, type SwipeDirection } from '../lib/facts/carousel';
import { href } from '../lib/router/hashRouter';
import { isJoined } from '../lib/sync/settings';
import { useSyncSettings } from '../lib/sync/useSyncSettings';
import { formatInZone } from '../lib/time/format';

const ALBUM_BACK = { path: '/album', label: 'Album' };

export default function AlbumFramePage({ params }: ParamPageProps) {
  const [frameId, photoId] = params;
  const frame = findFrame(frameId ?? '');
  const album = useAlbum();
  const settings = useSyncSettings();
  const joined = isJoined(settings);
  const photos = frame ? (photosByFrame(visiblePhotos(album)).get(frame.id) ?? []) : [];
  const [index, setIndex] = useState(() => viewerIndex(photos, photoId));
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const seenPhotos = useRef(0);

  // Once photos load, jump to the linked one.
  useEffect(() => {
    if (seenPhotos.current === 0 && photos.length > 0) setIndex(viewerIndex(photos, photoId));
    seenPhotos.current = photos.length;
  }, [photos.length]);

  const current = photos[Math.min(index, photos.length - 1)];
  const position = Math.min(index, photos.length - 1);

  useEffect(() => {
    setConfirming(false);
    setEditing(false);
    // Keep the address shareable without a re-route (hashchange would remount the page).
    if (frame && current) history.replaceState(null, '', href(`/album/${frame.id}/${current.id}`));
  }, [current?.id]);

  // Preload neighbours only.
  useEffect(() => {
    if (photos.length < 2) return;
    for (const d of [1, -1]) {
      const n = photos[wrapIndex(position + d, photos.length)];
      if (n && n.id !== current?.id) new Image().src = imageUrl(n.id, 'full');
    }
  }, [current?.id, photos.length]);

  const go = (dir: SwipeDirection) =>
    setIndex((i) => wrapIndex(i + (dir === 'next' ? 1 : -1), photos.length));
  const swipe = useCarousel(go, photos.length > 1);

  if (!frame) {
    return (
      <>
        <PageHeader title="Moment not found" back={ALBUM_BACK} />
        <p class="card">
          That isn’t one of our album moments. <a href={href('/album')}>See the album</a>.
        </p>
      </>
    );
  }

  const queued = current ? album.queue.items.find((q) => q.id === current.id) : undefined;
  const uploader = current && trip.travelers.find((t) => t.id === current.uploadedBy);
  const when = current && formatInZone(current.uploadedAt, trip.destinationTimeZone);
  const isCover = current && coverFor(photos, album.listing.frames[frame.id])?.id === current.id;

  return (
    <article class="album-viewer">
      <PageHeader
        title={`${frame.emoji} ${frame.title}`}
        subtitle={frame.prompt}
        back={ALBUM_BACK}
      />

      {photos.length === 0 ? (
        <p class="card album-viewer__empty">
          {album.status === 'loading' ? 'Loading…' : 'No photos yet. Be the first!'}
        </p>
      ) : (
        current && (
          <section aria-roledescription="carousel" aria-label={`${frame.title} photos`}>
            <figure
              class="album-viewer__stage"
              aria-roledescription="slide"
              {...swipe}
              aria-label={`Photo ${position + 1} of ${photos.length}, ${frame.title}`}
            >
              <img
                key={current.id}
                src={imageUrl(current.id, queued ? 'thumb' : 'full')}
                width={current.width}
                height={current.height}
                alt={current.caption ?? `${frame.title}, photo ${position + 1}`}
                decoding="async"
              />
              <figcaption class="album-viewer__caption">
                {editing ? (
                  <form
                    class="album-caption-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await editCaption(current, draft)) setEditing(false);
                    }}
                  >
                    <label htmlFor="album-caption">Caption</label>
                    <input
                      id="album-caption"
                      maxLength={MAX_CAPTION_CHARS}
                      value={draft}
                      onInput={(e) => setDraft(e.currentTarget.value)}
                    />
                    <button type="submit" class="button button--primary">
                      Save
                    </button>
                    <button type="button" class="button" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  current.caption && <p class="album-viewer__caption-text">{current.caption}</p>
                )}
                <p class="album-viewer__meta">
                  {uploader && <AvatarFace id={uploader.id} size={20} decorative />}
                  {uploader?.name} · {when?.date.replace(/ \d{4}$/, '')}, {when?.time}
                  {queued && (
                    <span class="album-viewer__pending">
                      {' '}
                      ·{' '}
                      {queued.state === 'failed'
                        ? queued.error
                        : queued.state === 'waiting-offline'
                          ? 'Waiting for signal'
                          : `Uploading ${Math.round((album.queue.progress[queued.id] ?? 0) * 100)}%`}
                    </span>
                  )}
                </p>
              </figcaption>
            </figure>

            {photos.length > 1 && (
              <div class="album-viewer__nav">
                <button
                  type="button"
                  class="button"
                  onClick={() => go('previous')}
                  aria-label="Previous photo"
                >
                  ←
                </button>
                <span aria-live="polite">
                  {position + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  class="button"
                  onClick={() => go('next')}
                  aria-label="Next photo"
                >
                  →
                </button>
              </div>
            )}

            {joined && (
              <div class="button-row album-viewer__actions">
                {queued?.state === 'failed' && (
                  <button type="button" class="button" onClick={() => void retryUpload(queued.id)}>
                    Try again
                  </button>
                )}
                {!queued && !editing && (
                  <button
                    type="button"
                    class="button"
                    onClick={() => {
                      setDraft(current.caption ?? '');
                      setEditing(true);
                    }}
                  >
                    {current.caption ? 'Edit caption' : 'Add caption'}
                  </button>
                )}
                {!queued && !isCover && (
                  <button
                    type="button"
                    class="button"
                    onClick={() => void makeCover(frame.id, current.id)}
                  >
                    Set as cover
                  </button>
                )}
                {confirming ? (
                  <span
                    class="album-viewer__confirm"
                    role="group"
                    aria-label="Delete this photo for everyone?"
                  >
                    Delete for everyone?
                    <button
                      type="button"
                      class="button button--danger"
                      onClick={() => {
                        setConfirming(false);
                        void deletePhoto(current.id);
                      }}
                    >
                      Delete
                    </button>
                    <button type="button" class="button" onClick={() => setConfirming(false)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button type="button" class="button" onClick={() => setConfirming(true)}>
                    Delete
                  </button>
                )}
              </div>
            )}

            {photos.length > 1 && (
              <ol class="album-strip" aria-label="All photos in this moment">
                {photos.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      class="album-strip__thumb"
                      aria-current={i === position ? 'true' : undefined}
                      aria-label={`Photo ${i + 1}`}
                      onClick={() => setIndex(i)}
                    >
                      <img
                        src={imageUrl(p.id, 'thumb')}
                        width={p.thumbWidth}
                        height={p.thumbHeight}
                        alt=""
                        loading="lazy"
                      />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      )}

      {joined ? <AddPhotoButtons frameId={frame.id} frameTitle={frame.title} /> : <AlbumJoin />}
    </article>
  );
}
