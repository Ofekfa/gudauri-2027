import type { Webcam } from '../../data/zones';

/** YouTube video ids are 11 characters from the URL-safe base-64 alphabet. */
export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** The privacy-enhanced player host; also the origin its messages come from. */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

/**
 * Embed URL for a live cam: muted autoplay (it only loads after a tap, and
 * muted so it never clashes with the background music), inline on iOS, and
 * the IFrame API enabled so the card can tell when the video is gone or
 * can't be embedded.
 */
export function webcamEmbedUrl(cam: Webcam, pageOrigin: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    enablejsapi: '1',
    origin: pageOrigin,
  });
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${encodeURIComponent(cam.id)}?${params.toString()}`;
}

export const webcamWatchUrl = (cam: Webcam) =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(cam.id)}`;

export const webcamThumbnailUrl = (cam: Webcam) =>
  `https://i.ytimg.com/vi/${encodeURIComponent(cam.id)}/hqdefault.jpg`;

/** What the parent sends so the player starts posting its events back. */
export const PLAYER_LISTEN_MESSAGE = JSON.stringify({
  event: 'listening',
  id: 1,
  channel: 'widget',
});

/**
 * The player's error code (100 gone, 101/150 embedding disabled, 2/5 other)
 * if this `message` event is a YouTube player error, else null.
 */
export function playerErrorCode(origin: string, data: unknown): number | null {
  if (origin !== YOUTUBE_EMBED_ORIGIN || typeof data !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { event, info } = parsed as { event?: unknown; info?: unknown };
  if (event !== 'onError') return null;
  return typeof info === 'number' ? info : Number(info) || 0;
}
