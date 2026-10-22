import { useState } from 'preact/hooks';
import { AlbumJoin } from '../components/album/AlbumJoin';
import { FrameCard } from '../components/album/FrameCard';
import { MomentForm } from '../components/album/MomentForm';
import { ProgressSummary } from '../components/common/ProgressSummary';
import { PageHeader } from '../components/PageHeader';
import { trip } from '../data/trip';
import { AVERAGE_PHOTO_BYTES, downloadAlbum } from '../lib/album/download';
import { albumProgress, pendingLabel, photosByFrame } from '../lib/album/selectors';
import { defaultAfter } from '../lib/album/moments';
import {
  createMoment,
  isPendingMoment,
  momentsOf,
  remoteImageUrl,
  visiblePhotos,
} from '../lib/album/service';
import { useAlbum } from '../lib/album/useAlbum';
import { href } from '../lib/router/hashRouter';
import { isJoined } from '../lib/sync/settings';
import { useSyncSettings } from '../lib/sync/useSyncSettings';
import { toasts } from '../lib/toast/toastStore';

const BYTES_PER_MB = 1_000_000;

export default function AlbumPage() {
  const album = useAlbum();
  const settings = useSyncSettings();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const joined = isJoined(settings);
  const moments = momentsOf(album);
  const photos = visiblePhotos(album);
  const byFrame = photosByFrame(photos, moments);
  const progress = albumProgress(byFrame, moments);
  const uploaded = album.listing.photos;
  const me = trip.travelers.find((t) => t.id === settings.me);

  const download = async () => {
    setDownloading('Starting…');
    try {
      await downloadAlbum(
        uploaded,
        (id) => remoteImageUrl(id, 'full'),
        (done, total) => setDownloading(`${done} / ${total}`),
        moments,
      );
    } catch {
      toasts.show({
        emoji: '⚠️',
        message: 'The download stopped. Check your connection and try again.',
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <PageHeader title="Trip album" subtitle="Our trip, one moment at a time" />
      <ProgressSummary
        id="album-progress"
        title="The story so far"
        done={progress.captured}
        total={progress.total}
        doneLabel="moments captured"
        badge={progress.bonus ? `+${progress.bonus} bonus` : undefined}
        ariaLabel={`${progress.captured} of ${progress.total} moments captured${progress.bonus ? `, plus ${progress.bonus} bonus` : ''}`}
      />
      {joined ? (
        <p class="album-intro">
          Adding as <strong>{me?.name}</strong>. Tap a moment’s 📷 to snap it; photos upload in the
          background, even offline.
        </p>
      ) : (
        <AlbumJoin />
      )}
      {album.status === 'error' && (
        <p class="card" role="status">
          The album couldn’t load. It will try again shortly.
        </p>
      )}
      <div class="button-row album-actions">
        {uploaded.length > 0 && (
          <a class="button" href={href('/album/story')}>
            <span aria-hidden="true">▶️</span> Story mode
          </a>
        )}
        {uploaded.length > 0 && (
          <button type="button" class="button" onClick={download} disabled={downloading !== null}>
            <span aria-hidden="true">⬇️</span>{' '}
            {downloading
              ? `Downloading ${downloading}`
              : `Download all (about ${Math.max(1, Math.round((uploaded.length * AVERAGE_PHOTO_BYTES) / BYTES_PER_MB))} MB)`}
          </button>
        )}
      </div>
      <ol class="album-grid" aria-label="Moments in story order">
        {moments.map((frame, i) => (
          <FrameCard
            key={frame.id}
            frame={frame}
            number={i + 1}
            photos={byFrame.get(frame.id) ?? []}
            state={album.listing.frames[frame.id]}
            pendingLabel={
              isPendingMoment(frame.id)
                ? 'Saving…'
                : pendingLabel(
                    album.queue.items.filter((q) => q.frameId === frame.id).map((q) => q.state),
                  )
            }
            canAdd={joined}
          />
        ))}
        {joined && (
          <li class="album-frame album-frame--new card">
            {adding ? (
              <>
                <h2 class="album-frame__title">New moment</h2>
                <MomentForm
                  idPrefix="new-moment"
                  moments={moments}
                  initial={{ title: '', emoji: '🥐', prompt: '', after: defaultAfter(moments) }}
                  submitLabel="Add moment"
                  onSubmit={async (input) => {
                    void createMoment(input);
                    return true;
                  }}
                  onCancel={() => setAdding(false)}
                />
              </>
            ) : (
              <button type="button" class="album-frame__add" onClick={() => setAdding(true)}>
                <span aria-hidden="true">＋</span> Add moment
              </button>
            )}
          </li>
        )}
      </ol>
    </>
  );
}
