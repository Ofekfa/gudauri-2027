import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpeechActivity, speechActivity } from './activity';
import { speak, stopSpeaking } from './synthesis';

describe('speech activity', () => {
  it('notifies only on real changes', () => {
    const activity = createSpeechActivity();
    const seen: string[] = [];
    activity.subscribe((a) => seen.push(`${a.listening}/${a.speaking}`));
    activity.setListening(true);
    activity.setListening(true);
    activity.setSpeaking(true);
    activity.setListening(false);
    expect(seen).toEqual(['true/false', 'true/true', 'false/true']);
  });
});

describe('speech synthesis reports activity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    stopSpeaking();
  });

  it('marks speaking from start to end, and stopSpeaking clears it', () => {
    let spoken: { onstart?: () => void; onend?: () => void } | null = null;
    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      getVoices: () => [],
      speak: (u: typeof spoken) => {
        spoken = u;
      },
    });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(public text: string) {}
      },
    );
    speak('Gamarjoba');
    expect(speechActivity.get().speaking).toBe(false);
    spoken!.onstart!();
    expect(speechActivity.get().speaking).toBe(true);
    spoken!.onend!();
    expect(speechActivity.get().speaking).toBe(false);
    speak('Madloba');
    spoken!.onstart!();
    stopSpeaking();
    expect(speechActivity.get().speaking).toBe(false);
  });
});
