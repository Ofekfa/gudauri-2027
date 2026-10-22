import { useEffect, useRef, useState } from 'preact/hooks';
import { showsGestureHint, shouldPlay } from '../../lib/music/machine';
import { music } from '../../lib/music/musicStore';
import { useMusic } from '../../lib/music/useMusic';
import { href } from '../../lib/router/hashRouter';
import { Icon } from '../Icon';

const VOLUME_STEPS = 100;

/** Compact header control: play/mute, next, and a "now playing" panel. */
export function MusicControl() {
  const view = useMusic();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { settings, snapshot } = view;
  const state = snapshot?.state;
  const track = snapshot?.track ?? null;
  const on = settings.enabled;
  const hint = !view.active && on && (state ? showsGestureHint(state) : true);
  const unavailable = state?.phase === 'unavailable';
  const audible = state ? shouldPlay(state) : false;

  useEffect(() => music.init(), []);

  // Close on Escape or a click outside; it's a disclosure, not a modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [open]);

  const status = !on
    ? 'Music off'
    : unavailable
      ? 'Music needs a connection'
      : hint
        ? 'Music ready — tap anywhere'
        : track
          ? track.title
          : 'Starting music…';

  return (
    <div class="music" ref={rootRef}>
      <button
        type="button"
        class="icon-button music__toggle"
        aria-pressed={on}
        aria-label="Background music"
        title={on ? 'Turn music off' : 'Turn music on'}
        onClick={() => music.toggle()}
      >
        <Icon name={on ? 'pause' : 'play'} size={18} />
      </button>
      <button
        type="button"
        class="music__status"
        aria-expanded={open}
        aria-controls="music-panel"
        onClick={() => setOpen(!open)}
      >
        <Icon name="music" size={16} />
        {hint ? (
          <span class="music__status-text">
            <span class="music__hint-long">Music ready — tap anywhere</span>
            <span class="music__hint-short">Tap for music</span>
          </span>
        ) : (
          <span class="music__status-text">{status}</span>
        )}
      </button>
      <button
        type="button"
        class="icon-button music__next"
        aria-label="Next track"
        disabled={!on || !view.active}
        onClick={() => music.next()}
      >
        <Icon name="skip" size={18} />
      </button>

      {/* Polite, and never moves focus. */}
      <p class="visually-hidden" aria-live="polite">
        {track && audible ? `Now playing: ${track.title} by ${track.artist}` : ''}
      </p>

      {open && (
        <section id="music-panel" class="music-panel card" aria-label="Now playing">
          {track ? (
            <>
              <p class="music-panel__title">{track.title}</p>
              <p class="music-panel__artist">{track.artist}</p>
              <p class="music-panel__meta">
                <span class={`music-panel__era music-panel__era--${track.era}`}>
                  {track.era === 'traditional' ? 'Traditional' : 'Modern'}
                </span>{' '}
                {track.style}
              </p>
              <p class="music-panel__license">
                {track.licenseUrl ? (
                  <a href={track.licenseUrl} target="_blank" rel="noopener noreferrer">
                    {track.license}
                  </a>
                ) : (
                  'Public domain'
                )}{' '}
                ·{' '}
                <a href={track.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Source
                </a>
                <span class="music-panel__attribution">{track.attribution}</span>
              </p>
            </>
          ) : (
            <p class="music-panel__title">
              {on ? (hint ? 'Music starts on your first tap.' : status) : 'Music is off.'}
            </p>
          )}
          {view.dataSaver && !settings.chosen && (
            <p class="music-panel__note">Music is off because your phone is saving data.</p>
          )}
          <label class="music-panel__volume" htmlFor="music-volume">
            Volume
            <input
              id="music-volume"
              type="range"
              min={0}
              max={VOLUME_STEPS}
              value={Math.round(settings.volume * VOLUME_STEPS)}
              onInput={(e) => music.setVolume(Number(e.currentTarget.value) / VOLUME_STEPS)}
            />
          </label>
          <p class="music-panel__note">
            Georgian music streamed from Wikimedia Commons and the Internet Archive (about 1 MB a
            minute of data). <a href={href('/music')}>All music and credits</a>
          </p>
        </section>
      )}
    </div>
  );
}
