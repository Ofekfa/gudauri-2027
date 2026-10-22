import { useEffect, useRef, useState } from 'preact/hooks';
import type { AlbumFrame } from '../../data/album';
import { indicator, photoHref, startIndex, step } from '../../lib/album/cardCarousel';
import type { AlbumPhoto } from '../../lib/album/protocol';
import { imageUrl } from '../../lib/album/service';
import type { SwipeDirection } from '../../lib/facts/carousel';
import { useCarousel } from './useCarousel';

interface CardCarouselProps {
  frame: AlbumFrame;
  photos: AlbumPhoto[];
  coverId: string | undefined;
}

/**
 * A moment's photos on its grid card: arrows, swipe, ← → while focused, and a
 * tap opens the moment at the shown photo. Only the shown thumbnail loads;
 * the next one is preloaded once someone starts browsing.
 */
export function CardCarousel({ frame, photos, coverId }: CardCarouselProps) {
  const [index, setIndex] = useState(() => startIndex(photos, coverId));
  const [browsing, setBrowsing] = useState(false);
  const swiped = useRef(false);
  const count = photos.length;
  const current = photos[Math.min(index, count - 1)]!;
  const position = photos.indexOf(current);
  const multiple = count > 1;

  const move = (dir: SwipeDirection) => {
    setBrowsing(true);
    setIndex((i) => step(Math.min(i, count - 1), dir, count));
  };
  const carousel = useCarousel(
    (dir) => {
      swiped.current = true;
      move(dir);
    },
    multiple,
    'element',
  );

  useEffect(() => {
    if (!browsing || !multiple) return;
    const next = photos[step(position, 'next', count)];
    if (next) new Image().src = imageUrl(next.id, 'thumb');
  }, [browsing, position, multiple, count, photos]);

  const shown = indicator(position, count);

  return (
    <div
      class="album-frame__media album-carousel"
      role={multiple ? 'group' : undefined}
      aria-roledescription={multiple ? 'carousel' : undefined}
      aria-label={multiple ? `${frame.title} photos` : undefined}
      onPointerDown={carousel.onPointerDown}
      onPointerUp={carousel.onPointerUp}
      onPointerCancel={carousel.onPointerCancel}
      onKeyDown={(e) => {
        carousel.onKeyDown?.(e);
        swiped.current = false;
      }}
    >
      <a
        class="album-carousel__photo"
        href={photoHref(frame.id, current.id)}
        aria-label={`${frame.title}, photo ${position + 1} of ${count}`}
        draggable={false}
        onClick={(e) => {
          // The end of a swipe isn't a tap.
          if (swiped.current) e.preventDefault();
          swiped.current = false;
        }}
      >
        <img
          key={current.id}
          src={imageUrl(current.id, 'thumb')}
          width={current.thumbWidth}
          height={current.thumbHeight}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </a>
      {multiple && (
        <>
          <button
            type="button"
            class="album-carousel__arrow album-carousel__arrow--previous"
            aria-label={`Previous photo, ${frame.title}`}
            onClick={() => move('previous')}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            class="album-carousel__arrow album-carousel__arrow--next"
            aria-label={`Next photo, ${frame.title}`}
            onClick={() => move('next')}
          >
            <span aria-hidden="true">›</span>
          </button>
          <span class="album-carousel__position" aria-hidden="true">
            {shown.kind === 'dots'
              ? Array.from({ length: shown.count }, (_, i) => (
                  <span
                    key={i}
                    class={`album-carousel__dot${i === shown.active ? ' album-carousel__dot--active' : ''}`}
                  />
                ))
              : shown.text}
          </span>
          <span class="visually-hidden" aria-live="polite">
            {browsing ? `Photo ${position + 1} of ${count}` : ''}
          </span>
        </>
      )}
      <span class="album-frame__count" aria-hidden="true">
        📷 {count}
      </span>
    </div>
  );
}
