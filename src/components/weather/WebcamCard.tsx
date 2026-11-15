import { useEffect, useRef, useState } from 'preact/hooks';
import type { Webcam } from '../../data/zones';
import {
  PLAYER_LISTEN_MESSAGE,
  YOUTUBE_EMBED_ORIGIN,
  playerErrorCode,
  webcamEmbedUrl,
  webcamThumbnailUrl,
  webcamWatchUrl,
} from '../../lib/weather/webcam';
import { Icon } from '../Icon';

/** Stop the stream when less than this share of the card is visible. */
const VISIBLE_THRESHOLD = 0.1;
/** The player only answers once it's ready, so keep saying "listening" for a while. */
const LISTEN_INTERVAL_MS = 250;
const LISTEN_ATTEMPTS = 40;
/** hqdefault thumbnails are 4:3; the card crops them to 16:9. */
const THUMB_WIDTH = 480;
const THUMB_HEIGHT = 360;
/** For a deleted video YouTube serves a grey 120 × 90 placeholder instead of a 404. */
const PLACEHOLDER_THUMB_WIDTH = 120;

type CamState = 'idle' | 'playing' | 'failed';

/**
 * Tap-to-load YouTube live cam (privacy-enhanced domain, muted). Nothing from
 * YouTube loads until tapped, and the player is removed when scrolled away or
 * the tab hides. If the player reports an error (stream ended, embedding
 * disabled), the card falls back to a thumbnail and a link.
 */
export function WebcamCard({ cam, zoneName }: { cam: Webcam; zoneName: string }) {
  const [state, setState] = useState<CamState>('idle');
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const listenTimer = useRef<number | undefined>(undefined);
  const playing = state === 'playing';

  useEffect(() => {
    if (!playing) return;
    const stop = () => setState('idle');
    const onVisibility = () => document.hidden && stop();
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      window.clearInterval(listenTimer.current);
      if (playerErrorCode(e.origin, e.data) !== null) setState('failed');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('message', onMessage);
    const observer = new IntersectionObserver(
      ([entry]) => entry && entry.intersectionRatio < VISIBLE_THRESHOLD && stop(),
      { threshold: [0, VISIBLE_THRESHOLD] },
    );
    if (boxRef.current) observer.observe(boxRef.current);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('message', onMessage);
      window.clearInterval(listenTimer.current);
      observer.disconnect();
    };
  }, [playing]);

  const onFrameLoad = () => {
    let attempts = 0;
    const listen = () => {
      frameRef.current?.contentWindow?.postMessage(PLAYER_LISTEN_MESSAGE, YOUTUBE_EMBED_ORIGIN);
      attempts += 1;
      if (attempts >= LISTEN_ATTEMPTS) window.clearInterval(listenTimer.current);
    };
    window.clearInterval(listenTimer.current);
    listen();
    listenTimer.current = window.setInterval(listen, LISTEN_INTERVAL_MS);
  };

  const watchUrl = webcamWatchUrl(cam);
  return (
    <figure class="webcam">
      <div class="webcam__frame" ref={boxRef}>
        {state === 'playing' && (
          <iframe
            ref={frameRef}
            src={webcamEmbedUrl(cam, window.location.origin)}
            title={`Live webcam: ${cam.label}, ${zoneName}`}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerpolicy="strict-origin-when-cross-origin"
            onLoad={onFrameLoad}
          />
        )}
        {state === 'idle' && (
          <button type="button" class="webcam__play" onClick={() => setState('playing')}>
            <span class="webcam__play-icon" aria-hidden="true">
              ▶
            </span>
            Play live cam
            <span class="webcam__play-sub">{cam.label}</span>
          </button>
        )}
        {state === 'failed' && (
          <div class="webcam__fallback" role="status">
            <img
              class="webcam__thumb"
              src={webcamThumbnailUrl(cam)}
              alt=""
              width={THUMB_WIDTH}
              height={THUMB_HEIGHT}
              loading="lazy"
              onLoad={(e) => {
                if (e.currentTarget.naturalWidth <= PLACEHOLDER_THUMB_WIDTH)
                  e.currentTarget.hidden = true;
              }}
              onError={(e) => (e.currentTarget.hidden = true)}
            />
            <div class="webcam__fallback-text">
              <p>This live cam can’t play here right now. The stream may have restarted.</p>
              <a href={watchUrl} target="_blank" rel="noopener noreferrer">
                Watch on YouTube ↗
              </a>
            </div>
          </div>
        )}
      </div>
      <figcaption class="webcam__caption">
        <Icon name="video" size={16} /> {zoneName} live cam · {cam.label} ·{' '}
        <a href={watchUrl} target="_blank" rel="noopener noreferrer">
          Watch on YouTube ↗
        </a>
      </figcaption>
    </figure>
  );
}
