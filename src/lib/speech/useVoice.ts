import { useEffect, useState } from 'preact/hooks';
import { isSynthesisSupported } from './synthesis';
import { findVoice } from './voices';

/**
 * The device's voice for a language, or null. Browsers often load voices late,
 * so this re-checks on `voiceschanged`.
 */
export function useVoice(langPrefix: string): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (!isSynthesisSupported()) return;
    const update = () => setVoice(findVoice(speechSynthesis.getVoices(), langPrefix));
    update();
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, [langPrefix]);
  return voice;
}
