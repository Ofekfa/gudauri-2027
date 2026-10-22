/** Text-to-speech via speechSynthesis, with an English voice when one exists. */
import { speechActivity } from './activity';

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

/** Lets background music duck while this utterance plays. */
function reportActivity(utterance: SpeechSynthesisUtterance) {
  utterance.onstart = () => speechActivity.setSpeaking(true);
  utterance.onend = () => speechActivity.setSpeaking(false);
  utterance.onerror = () => speechActivity.setSpeaking(false);
}

export function speak(text: string): void {
  if (!isSynthesisSupported()) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = SPEECH_RATE;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  reportActivity(utterance);
  speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isSynthesisSupported()) speechSynthesis.cancel();
  speechActivity.setSpeaking(false);
}

/** Speaks with a specific voice (e.g. a Georgian one found via findVoice). */
export function speakWithVoice(text: string, voice: SpeechSynthesisVoice): void {
  if (!isSynthesisSupported()) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  reportActivity(utterance);
  speechSynthesis.speak(utterance);
}
