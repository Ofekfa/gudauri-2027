import { useEffect, useRef, useState } from 'preact/hooks';
import type { Webcam } from '../../data/zones';
import { Icon } from '../Icon';

/** Stop the stream when less than this share of the card is visible. */
const VISIBLE_THRESHOLD = 0.1;

/**
 * Tap-to-load YouTube live cam (privacy-enhanced domain). Nothing from YouTube
 * loads until tapped, and the player is removed when scrolled away or the tab hides.
 */
export function WebcamCard({ cam, zoneName }: { cam: Webcam; zoneName: string }) {
  const [playing, setPlaying] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    const stop = () => setPlaying(false);
    const onVisibility = () => document.hidden && stop();
    document.addEventListener('visibilitychange', onVisibility);
    const observer = new IntersectionObserver(
      ([entry]) => entry && entry.intersectionRatio < VISIBLE_THRESHOLD && stop(),
      { threshold: [0, VISIBLE_THRESHOLD] },
    );
    if (boxRef.current) observer.observe(boxRef.current);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  }, [playing]);

  const watchUrl = `https://www.youtube.com/watch?v=${cam.id}`;
  return (
    <figure class="webcam">
      <div class="webcam__frame" ref={boxRef}>
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${cam.id}?autoplay=1&mute=1&playsinline=1`}
            title={`Live webcam: ${cam.label}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerpolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" class="webcam__play" onClick={() => setPlaying(true)}>
            <span class="webcam__play-icon" aria-hidden="true">
              ▶
            </span>
            Play live cam
            <span class="webcam__play-sub">{cam.label}</span>
          </button>
        )}
      </div>
      <figcaption class="webcam__caption">
        <Icon name="video" size={16} /> {zoneName} live cam ·{' '}
        <a href={watchUrl} target="_blank" rel="noopener noreferrer">
          Open on YouTube ↗
        </a>
      </figcaption>
    </figure>
  );
}
