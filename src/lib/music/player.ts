/**
 * The background-music player (lazy chunk, loaded on the first gesture).
 * Owns playback of the shell's single <audio> element and wires the pure
 * pieces together: state machine, settings, shuffle bag, Media Session.
 */
import { TRACKS, type Track } from '../../data/tracks';
import { appStore, type KeyValueStore } from '../storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';
import {
  initialMusicState,
  musicReducer,
  needsTrack,
  shouldPlay,
  volumeFactor,
  type MusicEvent,
  type MusicState,
} from './machine';
import { saveMusicSettings, type MusicSettings } from './settings';
import { emptyBag, nextTrack, type BagState } from './shuffleBag';

/** A track that hasn't started within this long counts as failed. */
const LOAD_TIMEOUT_MS = 20_000;
/** Hosts (archive.org especially) fail now and then; retry once after this pause before skipping. */
const RETRY_DELAY_MS = 1_500;
const BAG_VERSION = 1;

interface StoredBag extends BagState {
  version: typeof BAG_VERSION;
}

const bagSpec: VersionedSpec<StoredBag> = {
  key: 'music:bag',
  version: BAG_VERSION,
  validate: (raw) => {
    const r = raw as Partial<StoredBag> | null;
    if (!r || !Array.isArray(r.remaining) || !r.remaining.every((id) => typeof id === 'string'))
      return null;
    return {
      version: BAG_VERSION,
      remaining: r.remaining,
      lastArtist: typeof r.lastArtist === 'string' ? r.lastArtist : null,
      recentEras: Array.isArray(r.recentEras)
        ? r.recentEras.filter((e) => e === 'traditional' || e === 'modern')
        : [],
    };
  },
  empty: () => ({ version: BAG_VERSION, ...emptyBag() }),
};

export interface MusicSnapshot {
  state: MusicState;
  settings: MusicSettings;
  track: Track | null;
}

export interface PlayerDeps {
  audio: HTMLAudioElement;
  settings: MusicSettings;
  tracks?: readonly Track[];
  store?: KeyValueStore;
  random?: () => number;
  /** The first gesture already happened (the shell loads us from it). */
  started?: boolean;
}

/** Linear volume for a track: the user's level, the track's loudness offset, ducking. */
export const trackVolume = (userVolume: number, gainDb: number, factor: number) =>
  Math.min(1, Math.max(0, userVolume * 10 ** (gainDb / 20) * factor));

export function createMusicPlayer({
  audio,
  settings: initialSettings,
  tracks = TRACKS,
  store = appStore,
  random = Math.random,
  started = false,
}: PlayerDeps) {
  let settings = initialSettings;
  let state = initialMusicState(settings.enabled);
  let track: Track | null = null;
  let bag: BagState = loadVersioned(store, bagSpec).value;
  let loadTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(s: MusicSnapshot) => void>();
  const preload = new Audio();
  preload.preload = 'metadata';

  const snapshot = (): MusicSnapshot => ({ state, settings, track });
  const emit = () => listeners.forEach((l) => l(snapshot()));

  function pickNext(): Track {
    const next = nextTrack(bag, tracks, random);
    bag = next.state;
    saveVersioned(store, bagSpec, { version: BAG_VERSION, ...bag });
    return tracks.find((t) => t.id === next.track.id)!;
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: 'Gudauri 2027',
    });
    navigator.mediaSession.playbackState = shouldPlay(state) ? 'playing' : 'paused';
  }

  function applyVolume() {
    audio.volume = trackVolume(settings.volume, track?.gainDb ?? 0, volumeFactor(state));
  }

  let retried = false;

  function startTrack() {
    track = pickNext();
    retried = false;
    audio.src = track.src;
    applyVolume();
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => dispatch({ type: 'ERROR' }), LOAD_TIMEOUT_MS);
    // Only the next track's metadata, never the whole file ahead.
    const upcoming = tracks.find((t) => t.id === bag.remaining[0]);
    if (upcoming) preload.src = upcoming.src;
  }

  function sync() {
    if (needsTrack(state)) startTrack();
    applyVolume();
    if (shouldPlay(state) && audio.src) {
      audio.play().catch((err: unknown) => {
        // Blocked by autoplay rules: wait for the next gesture.
        if (err instanceof DOMException && err.name === 'NotAllowedError')
          state = { ...state, phase: 'waiting' };
        emit();
      });
    } else {
      audio.pause();
      if (!shouldPlay(state)) clearTimeout(loadTimer);
    }
    updateMediaSession();
  }

  function dispatch(event: MusicEvent) {
    const before = state;
    state = musicReducer(state, event);
    if (event.type === 'TOGGLE' || event.type === 'SET_ENABLED') {
      settings = saveMusicSettings({ enabled: state.enabled }, settings, store);
    }
    if (
      state !== before ||
      event.type === 'NEXT' ||
      event.type === 'ENDED' ||
      event.type === 'ERROR'
    )
      sync();
    emit();
  }

  audio.addEventListener('playing', () => {
    clearTimeout(loadTimer);
    dispatch({ type: 'READY' });
  });
  audio.addEventListener('ended', () => dispatch({ type: 'ENDED' }));
  audio.addEventListener('error', () => {
    // The unlock clip has no track.
    if (!track) return;
    const failed = track;
    if (!retried) {
      retried = true;
      setTimeout(() => {
        // Still the same track and still wanted: try the same file once more.
        if (track !== failed || !shouldPlay(state)) return;
        audio.src = failed.src;
        sync();
      }, RETRY_DELAY_MS);
      return;
    }
    // Missing, undecodable or still failing: skip it.
    if (import.meta.env.DEV) console.warn('[music] skipped', failed.id, audio.error?.message);
    dispatch({ type: 'ERROR' });
  });
  document.addEventListener('visibilitychange', () =>
    dispatch({ type: 'VISIBILITY', hidden: document.hidden }),
  );
  window.addEventListener('online', () => dispatch({ type: 'ONLINE' }));

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () =>
      dispatch({ type: 'SET_ENABLED', enabled: true }),
    );
    navigator.mediaSession.setActionHandler('pause', () =>
      dispatch({ type: 'SET_ENABLED', enabled: false }),
    );
    navigator.mediaSession.setActionHandler('nexttrack', () => dispatch({ type: 'NEXT' }));
  }

  if (started) dispatch({ type: 'GESTURE' });

  return {
    dispatch,
    getSnapshot: snapshot,
    setVolume(volume: number) {
      settings = saveMusicSettings({ volume }, settings, store);
      applyVolume();
      emit();
    },
    subscribe(listener: (s: MusicSnapshot) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type MusicPlayer = ReturnType<typeof createMusicPlayer>;
