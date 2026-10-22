import { useEffect, useState } from 'preact/hooks';
import type { MusicEmbed } from '../../data/musicEmbeds';
import { music } from '../../lib/music/musicStore';

const embedSrc = (e: MusicEmbed) =>
  e.kind === 'playlist'
    ? `https://www.youtube-nocookie.com/embed/videoseries?list=${e.id}&autoplay=1&playsinline=1`
    : `https://www.youtube-nocookie.com/embed/${e.id}?autoplay=1&playsinline=1`;
const watchUrl = (e: MusicEmbed) =>
  e.kind === 'playlist'
    ? `https://www.youtube.com/playlist?list=${e.id}`
    : `https://www.youtube.com/watch?v=${e.id}`;

/**
 * Tap-to-load official YouTube player. Nothing from YouTube loads until
 * tapped; while it's loaded, background music steps aside.
 */
export function EmbedCard({ embed }: { embed: MusicEmbed }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    music.setExternal(playing);
    return () => music.setExternal(false);
  }, [playing]);

  return (
    <figure class="webcam embed-card">
      <div class="webcam__frame">
        {playing ? (
          <iframe
            src={embedSrc(embed)}
            title={`${embed.artist}: ${embed.title} (YouTube)`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerpolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" class="webcam__play" onClick={() => setPlaying(true)}>
            <span class="webcam__play-icon" aria-hidden="true">
              ▶
            </span>
            {embed.artist}
            <span class="webcam__play-sub">
              {embed.genre} · {embed.kind === 'playlist' ? 'playlist' : 'video'}
            </span>
          </button>
        )}
      </div>
      <figcaption class="webcam__caption embed-card__caption">
        <span>
          {embed.title} · {embed.channel}
        </span>
        <span class="embed-card__actions">
          {playing && (
            <button type="button" class="link-button" onClick={() => setPlaying(false)}>
              Close player
            </button>
          )}
          <a href={watchUrl(embed)} target="_blank" rel="noopener noreferrer">
            Open on YouTube ↗
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
