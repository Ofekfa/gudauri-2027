/**
 * Always-loaded front for the background music (kept tiny). It owns the one
 * audio element (created on the first gesture and kept for the whole visit,
 * so music continues across pages), shows the "tap anywhere" state, and
 * unlocks audio synchronously inside that gesture (iOS requires play() there)
 * before lazy-loading the real player. No audio is fetched before it.
 */
import { speechActivity } from '../speech/activity';
import {
  loadMusicSettings,
  prefersNoAutoMusic,
  saveMusicSettings,
  type ConnectionHints,
  type MusicSettings,
} from './settings';
import type { MusicPlayer, MusicSnapshot } from './player';

/** 0.1 s of silence: playing it inside the gesture unlocks the element on iOS. */
const SILENCE =
  'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYzLjEuMTAyAAAAAAAAAAAAAAD/4zjAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAAB+ACSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpK2tra2tra2tra2tra2tra2tra2tra2tra229vb29vb29vb29vb29vb29vb29vb29vb2/////////////////////////////////8AAAAATGF2YzYzLjEuAAAAAAAAAAAAAAAAJAOgAAAAAAAAAfgv8/PNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/4xjEAAAAA0gAAAAATEFNRTQuMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjEOwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjEdgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/4xjEsQAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';

export interface MusicView {
  /** The player chunk is running. */
  active: boolean;
  settings: MusicSettings;
  /** Started muted because of Save-Data / a slow connection. */
  dataSaver: boolean;
  snapshot: MusicSnapshot | null;
}

type Listener = (view: MusicView) => void;

const connection = (navigator as Navigator & { connection?: ConnectionHints }).connection;
let settings = loadMusicSettings(connection);
let player: MusicPlayer | null = null;
let audio: HTMLAudioElement | null = null;
let loading = false;
const listeners = new Set<Listener>();

const view = (): MusicView => ({
  active: player !== null,
  settings: player?.getSnapshot().settings ?? settings,
  dataSaver: !settings.chosen && prefersNoAutoMusic(connection),
  snapshot: player?.getSnapshot() ?? null,
});
const emit = () => listeners.forEach((l) => l(view()));

function unlock(el: HTMLAudioElement) {
  el.src = SILENCE;
  el.play().catch(() => {
    /* Some browsers don't need (or allow) this; the real play() will tell. */
  });
}

async function start() {
  if (player || loading || !audio) return;
  loading = true;
  try {
    const { createMusicPlayer } = await import('./player');
    player = createMusicPlayer({ audio, settings, started: true });
    player.subscribe(emit);
    speechActivity.subscribe(({ listening, speaking }) => {
      player?.dispatch({ type: 'LISTENING', active: listening });
      player?.dispatch({ type: 'SPEAKING', active: speaking });
    });
  } catch {
    /* Music is optional; stay quiet if the chunk can't load (offline). */
  } finally {
    loading = false;
    emit();
  }
}

/** Creates the element and unlocks it; must run synchronously inside a gesture. */
function startFromGesture() {
  audio ??= new Audio();
  unlock(audio);
  void start();
}

function onFirstGesture() {
  window.removeEventListener('pointerdown', onFirstGesture, true);
  window.removeEventListener('keydown', onFirstGesture, true);
  if (settings.enabled) startFromGesture();
}

let initialised = false;

export const music = {
  /** Called once by the shell: waits for the first gesture. */
  init() {
    if (initialised) return;
    initialised = true;
    window.addEventListener('pointerdown', onFirstGesture, true);
    window.addEventListener('keydown', onFirstGesture, true);
  },
  getView: view,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Play/pause button: also counts as the first gesture when turning music on. */
  toggle() {
    if (player) return player.dispatch({ type: 'TOGGLE' });
    settings = saveMusicSettings({ enabled: !settings.enabled }, settings);
    // Turning music on is itself a gesture (this runs inside the click).
    if (settings.enabled) startFromGesture();
    emit();
  },
  next() {
    player?.dispatch({ type: 'NEXT' });
  },
  setVolume(volume: number) {
    if (player) player.setVolume(volume);
    else {
      settings = saveMusicSettings({ volume }, settings);
      emit();
    }
  },
  /** An embedded player (Music page) took over or let go. */
  setExternal(active: boolean) {
    player?.dispatch({ type: 'EXTERNAL', active });
  },
};
