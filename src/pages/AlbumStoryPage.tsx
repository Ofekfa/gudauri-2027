import { useState } from 'preact/hooks';
import { PageHeader } from '../components/PageHeader';
import { storySlides } from '../lib/album/selectors';
import { imageUrl } from '../lib/album/service';
import { useAlbum } from '../lib/album/useAlbum';
import { useCarousel } from '../components/album/useCarousel';
import { wrapIndex, type SwipeDirection } from '../lib/facts/carousel';

export default function AlbumStoryPage() {
  const album = useAlbum();
  const slides = storySlides(album.listing.photos);
  const [index, setIndex] = useState(0);
  const position = Math.min(index, Math.max(0, slides.length - 1));
  const slide = slides[position];
  const go = (dir: SwipeDirection) =>
    setIndex((i) => wrapIndex(i + (dir === 'next' ? 1 : -1), slides.length));
  const swipe = useCarousel(go, slides.length > 1);

  return (
    <article class="album-story">
      <PageHeader
        title="Our story"
        subtitle="The trip, moment by moment"
        back={{ path: '/album', label: 'Album' }}
      />
      {!slide ? (
        <p class="card">{album.status === 'loading' ? 'Loading…' : 'No photos yet.'}</p>
      ) : (
        <section aria-roledescription="slideshow" aria-label="Trip story">
          <div
            class="album-story__stage"
            aria-roledescription="slide"
            {...swipe}
            aria-label={`Slide ${position + 1} of ${slides.length}`}
          >
            {slide.kind === 'title' ? (
              <div class="album-story__title">
                <span class="album-story__emoji" aria-hidden="true">
                  {slide.frame.emoji}
                </span>
                <h2>{slide.frame.title}</h2>
                <p>
                  {slide.count} photo{slide.count > 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <figure>
                <img
                  key={slide.photo.id}
                  src={imageUrl(slide.photo.id, 'full')}
                  width={slide.photo.width}
                  height={slide.photo.height}
                  alt={slide.photo.caption ?? slide.frame.title}
                  decoding="async"
                />
                {slide.photo.caption && <figcaption>{slide.photo.caption}</figcaption>}
              </figure>
            )}
          </div>
          <div class="album-viewer__nav">
            <button
              type="button"
              class="button"
              onClick={() => go('previous')}
              aria-label="Previous"
            >
              ←
            </button>
            <span aria-live="polite">
              {position + 1} / {slides.length}
            </span>
            <button type="button" class="button" onClick={() => go('next')} aria-label="Next">
              →
            </button>
          </div>
        </section>
      )}
    </article>
  );
}
