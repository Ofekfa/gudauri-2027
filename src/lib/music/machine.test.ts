import { describe, expect, it } from 'vitest';
import {
  DUCK_FACTOR,
  initialMusicState,
  MAX_FAILURES,
  musicReducer,
  needsTrack,
  shouldPlay,
  showsGestureHint,
  volumeFactor,
  type MusicEvent,
  type MusicState,
} from './machine';

const run = (state: MusicState, ...events: MusicEvent[]) => events.reduce(musicReducer, state);
const on = initialMusicState(true);
const off = initialMusicState(false);

describe('music state machine', () => {
  it('waits for a gesture, showing the hint only when music is on', () => {
    expect(shouldPlay(on)).toBe(false);
    expect(showsGestureHint(on)).toBe(true);
    expect(showsGestureHint(off)).toBe(false);
    const started = run(on, { type: 'GESTURE' });
    expect(needsTrack(started, 0)).toBe(true);
    expect(run(started, { type: 'READY' }).phase).toBe('playing');
  });

  it('never plays once muted, whatever happens next', () => {
    const muted = run(on, { type: 'GESTURE' }, { type: 'READY' }, { type: 'TOGGLE' });
    const later = run(
      muted,
      { type: 'NEXT' },
      { type: 'ENDED' },
      { type: 'READY' },
      { type: 'VISIBILITY', hidden: false },
      { type: 'SPEAKING', active: false },
      { type: 'ONLINE' },
      { type: 'GESTURE' },
    );
    expect(shouldPlay(later)).toBe(false);
    // A returning visitor who muted: gestures alone never start anything.
    expect(shouldPlay(run(off, { type: 'GESTURE' }, { type: 'NEXT' }))).toBe(false);
  });

  it('muting while a track loads never lets it play', () => {
    const loading = run(on, { type: 'GESTURE' });
    expect(shouldPlay(run(loading, { type: 'TOGGLE' }, { type: 'READY' }))).toBe(false);
  });

  it('turning music on counts as the gesture', () => {
    expect(needsTrack(run(off, { type: 'TOGGLE' }), 0)).toBe(true);
  });

  it('skips failing tracks and gives up after repeated failures', () => {
    let s = run(on, { type: 'GESTURE' });
    for (let i = 1; i < MAX_FAILURES; i++) {
      s = run(s, { type: 'ERROR' });
      expect(needsTrack(s, s.trackRequest - 1)).toBe(true);
    }
    s = run(s, { type: 'ERROR' });
    expect(s.phase).toBe('unavailable');
    expect(shouldPlay(s)).toBe(false);
    expect(needsTrack(run(s, { type: 'ONLINE' }), s.trackRequest)).toBe(true);
    // A success resets the count.
    expect(run(on, { type: 'GESTURE' }, { type: 'ERROR' }, { type: 'READY' }).failures).toBe(0);
  });

  it('asks for each new track once; pausing and resuming mid-load never re-picks', () => {
    const loading = run(on, { type: 'GESTURE' });
    const served = loading.trackRequest;
    expect(needsTrack(loading, served)).toBe(false);
    const resumed = run(
      loading,
      { type: 'LISTENING', active: true },
      { type: 'LISTENING', active: false },
      { type: 'VISIBILITY', hidden: true },
      { type: 'VISIBILITY', hidden: false },
      { type: 'SPEAKING', active: true },
      { type: 'TOGGLE' },
      { type: 'TOGGLE' },
    );
    expect(shouldPlay(resumed)).toBe(true);
    expect(needsTrack(resumed, served)).toBe(false);
    expect(needsTrack(run(resumed, { type: 'NEXT' }), served)).toBe(true);
    expect(needsTrack(run(resumed, { type: 'ENDED' }), served)).toBe(true);
    // A skip requested while muted is served when music comes back on.
    const mutedNext = run(resumed, { type: 'TOGGLE' }, { type: 'NEXT' });
    expect(needsTrack(mutedNext, served)).toBe(false);
    expect(needsTrack(run(mutedNext, { type: 'TOGGLE' }), served)).toBe(true);
  });

  it('pauses while the mic listens and ducks while speech plays, then resumes', () => {
    const playing = run(on, { type: 'GESTURE' }, { type: 'READY' });
    const listening = run(playing, { type: 'LISTENING', active: true });
    expect(shouldPlay(listening)).toBe(false);
    expect(shouldPlay(run(listening, { type: 'LISTENING', active: false }))).toBe(true);
    const speaking = run(playing, { type: 'SPEAKING', active: true });
    expect(shouldPlay(speaking)).toBe(true);
    expect(volumeFactor(speaking)).toBe(DUCK_FACTOR);
    expect(volumeFactor(run(speaking, { type: 'SPEAKING', active: false }))).toBe(1);
  });

  it('pauses in a hidden tab and for an embedded player, resuming only if it was playing', () => {
    const playing = run(on, { type: 'GESTURE' }, { type: 'READY' });
    expect(shouldPlay(run(playing, { type: 'VISIBILITY', hidden: true }))).toBe(false);
    expect(
      shouldPlay(
        run(playing, { type: 'VISIBILITY', hidden: true }, { type: 'VISIBILITY', hidden: false }),
      ),
    ).toBe(true);
    expect(shouldPlay(run(playing, { type: 'EXTERNAL', active: true }))).toBe(false);
    const mutedHidden = run(
      playing,
      { type: 'TOGGLE' },
      { type: 'VISIBILITY', hidden: true },
      { type: 'VISIBILITY', hidden: false },
    );
    expect(shouldPlay(mutedHidden)).toBe(false);
  });
});
