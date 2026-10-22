/**
 * Pure state machine for the background music. Whether audio should be
 * playing, and how loud, is derived from flags, so "never play after the
 * user muted" holds by construction.
 */

/** Consecutive track failures before we stop trying (e.g. offline). */
export const MAX_FAILURES = 3;
/** Volume factor while the assistant speaks. */
export const DUCK_FACTOR = 0.2;

export type Phase =
  /** No user gesture yet: browsers block audible autoplay until one. */
  | 'waiting'
  /** Fetching/starting a track. */
  | 'loading'
  | 'playing'
  /** Too many failures in a row (offline, host down). */
  | 'unavailable';

export interface MusicState {
  phase: Phase;
  /** The user's choice (or the default): false means muted, and nothing ever plays. */
  enabled: boolean;
  hidden: boolean;
  /** The assistant's microphone is listening. */
  listening: boolean;
  /** The assistant (or a word card) is speaking. */
  speaking: boolean;
  /** An embedded player on the Music page took over. */
  external: boolean;
  failures: number;
}

export type MusicEvent =
  | { type: 'GESTURE' }
  | { type: 'TOGGLE' }
  | { type: 'SET_ENABLED'; enabled: boolean }
  | { type: 'NEXT' }
  | { type: 'ENDED' }
  | { type: 'READY' }
  | { type: 'ERROR' }
  | { type: 'VISIBILITY'; hidden: boolean }
  | { type: 'LISTENING'; active: boolean }
  | { type: 'SPEAKING'; active: boolean }
  | { type: 'EXTERNAL'; active: boolean }
  | { type: 'ONLINE' };

export const initialMusicState = (enabled: boolean): MusicState => ({
  phase: 'waiting',
  enabled,
  hidden: false,
  listening: false,
  speaking: false,
  external: false,
  failures: 0,
});

export function musicReducer(state: MusicState, event: MusicEvent): MusicState {
  switch (event.type) {
    case 'GESTURE':
      return state.phase === 'waiting' ? { ...state, phase: 'loading' } : state;
    case 'TOGGLE':
      return musicReducer(state, { type: 'SET_ENABLED', enabled: !state.enabled });
    case 'SET_ENABLED': {
      const next = { ...state, enabled: event.enabled };
      // Turning music on is a gesture too, and a fresh start after failures.
      if (event.enabled && (state.phase === 'waiting' || state.phase === 'unavailable')) {
        return { ...next, phase: 'loading', failures: 0 };
      }
      return next;
    }
    case 'NEXT':
    case 'ENDED':
      return state.phase === 'waiting' ? state : { ...state, phase: 'loading' };
    case 'READY':
      return state.phase === 'loading' ? { ...state, phase: 'playing', failures: 0 } : state;
    case 'ERROR': {
      const failures = state.failures + 1;
      return failures >= MAX_FAILURES
        ? { ...state, phase: 'unavailable', failures }
        : { ...state, phase: 'loading', failures };
    }
    case 'VISIBILITY':
      return { ...state, hidden: event.hidden };
    case 'LISTENING':
      return { ...state, listening: event.active };
    case 'SPEAKING':
      return { ...state, speaking: event.active };
    case 'EXTERNAL':
      return { ...state, external: event.active };
    case 'ONLINE':
      return state.phase === 'unavailable' ? { ...state, phase: 'loading', failures: 0 } : state;
  }
}

/** Should the <audio> element be producing sound right now? */
export const shouldPlay = (s: MusicState) =>
  s.enabled &&
  (s.phase === 'loading' || s.phase === 'playing') &&
  !s.hidden &&
  !s.listening &&
  !s.external;

/** A track needs loading: the machine asked for one and playback is allowed. */
export const needsTrack = (s: MusicState) => s.phase === 'loading' && shouldPlay(s);

export const volumeFactor = (s: MusicState) => (s.speaking ? DUCK_FACTOR : 1);

/** The header hint: music is on but waiting for the first tap. */
export const showsGestureHint = (s: MusicState) => s.enabled && s.phase === 'waiting';
