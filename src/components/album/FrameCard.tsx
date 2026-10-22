import { useState } from 'preact/hooks';
import type { AlbumFrame } from '../../data/album';
import { coverFor } from '../../lib/album/selectors';
import { addPhotos } from '../../lib/album/service';
import type { AlbumFrameState, AlbumPhoto } from '../../lib/album/protocol';
import { href } from '../../lib/router/hashRouter';
import { AddPhotoButtons } from './AddPhotoButtons';
import { CardCarousel } from './CardCarousel';

interface FrameCardProps {
  frame: AlbumFrame;
  number: number;
  photos: AlbumPhoto[];
  state: AlbumFrameState | undefined;
  /** e.g. "Uploading 2…" for photos still on this phone. */
  pendingLabel: string | null;
  canAdd: boolean;
}

const imageFiles = (list: FileList | undefined | null) =>
  [...(list ?? [])].filter((f) => f.type.startsWith('image/'));

/** One moment of the story: its photos (browsable in place) or an empty frame, and add buttons. */
export function FrameCard({ frame, number, photos, state, pendingLabel, canAdd }: FrameCardProps) {
  const [dragging, setDragging] = useState(false);
  const titleId = `frame-${frame.id}`;
  const count = photos.length;

  return (
    <li
      class={`album-frame card${count ? '' : ' album-frame--empty'}${dragging ? ' album-frame--drop' : ''}${count > 1 ? ' album-frame--stack' : ''}`}
      aria-labelledby={titleId}
      onDragOver={(e) => {
        if (!canAdd) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canAdd) return;
        e.preventDefault();
        setDragging(false);
        void addPhotos(frame.id, imageFiles(e.dataTransfer?.files));
      }}
    >
      {count > 0 ? (
        <CardCarousel frame={frame} photos={photos} coverId={coverFor(photos, state)?.id} />
      ) : (
        <a
          class="album-frame__media"
          href={href(`/album/${frame.id}`)}
          tabIndex={-1}
          aria-hidden="true"
        >
          <span class="album-frame__emoji">{frame.emoji}</span>
        </a>
      )}
      <a class="album-frame__link" href={href(`/album/${frame.id}`)}>
        <span class="album-frame__text">
          <span class="album-frame__number" aria-hidden="true">
            {String(number).padStart(2, '0')}
          </span>
          <span id={titleId} class="album-frame__title">
            {frame.title}
          </span>
          <span class="visually-hidden">
            {count ? `, ${count} photo${count > 1 ? 's' : ''}` : ', no photos yet'}
          </span>
          {!count && <span class="album-frame__prompt">{frame.prompt}</span>}
          {pendingLabel && <span class="album-frame__status">{pendingLabel}</span>}
        </span>
      </a>
      {canAdd && <AddPhotoButtons frameId={frame.id} frameTitle={frame.title} />}
    </li>
  );
}
