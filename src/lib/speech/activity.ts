/**
 * Tiny store of what the voice features are doing, so background music can
 * pause for the microphone and duck under speech. Framework-free.
 */
export interface SpeechActivity {
  listening: boolean;
  speaking: boolean;
}

type Listener = (activity: SpeechActivity) => void;

export function createSpeechActivity() {
  let activity: SpeechActivity = { listening: false, speaking: false };
  const listeners = new Set<Listener>();
  const set = (change: Partial<SpeechActivity>) => {
    const next = { ...activity, ...change };
    if (next.listening === activity.listening && next.speaking === activity.speaking) return;
    activity = next;
    listeners.forEach((l) => l(activity));
  };
  return {
    get: () => activity,
    setListening: (listening: boolean) => set({ listening }),
    setSpeaking: (speaking: boolean) => set({ speaking }),
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const speechActivity = createSpeechActivity();
