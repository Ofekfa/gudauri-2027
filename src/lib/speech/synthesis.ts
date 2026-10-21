/** Text-to-speech via speechSynthesis, with an English voice when one exists. */

export const isSynthesisSupported = () =>
  typeof globalThis.speechSynthesis !== 'undefined' &&
  typeof globalThis.SpeechSynthesisUtterance !== 'undefined';

const PREFERRED_LANG = 'en';
const SPEECH_RATE = 1.02;

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-US' && v.localService) ??
    voices.find((v) => v.lang.startsWith(PREFERRED_LANG))
  );
}

export function speak(text: string): void {
  if (!isSynthesisSupported()) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = SPEECH_RATE;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isSynthesisSupported()) speechSynthesis.cancel();
}

/** Speaks with a specific voice (e.g. a Georgian one found via findVoice). */
export function speakWithVoice(text: string, voice: SpeechSynthesisVoice): void {
  if (!isSynthesisSupported()) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  speechSynthesis.speak(utterance);
}
