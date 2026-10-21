/**
 * Thin wrapper over the Web Speech API's SpeechRecognition (Chrome, Edge,
 * Safari; missing in Firefox). Always feature-detect: callers fall back to text.
 */

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  const w = globalThis as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const isRecognitionSupported = () => getCtor() !== null;

export type RecognitionError = 'not-allowed' | 'no-speech' | 'network' | 'other';

export interface RecognizerHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: RecognitionError) => void;
  onEnd: () => void;
}

export function mapRecognitionError(code: string): RecognitionError {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'not-allowed';
  if (code === 'no-speech' || code === 'aborted') return 'no-speech';
  if (code === 'network') return 'network';
  return 'other';
}

/** One utterance per start(): listens until a pause, then reports the final text. */
export function createRecognizer(handlers: RecognizerHandlers, lang = 'en-US') {
  const Ctor = getCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]!;
      if (result.isFinal) final += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (final.trim()) handlers.onFinal(final.trim());
    else if (interim) handlers.onInterim(interim);
  };
  recognition.onerror = (event) => handlers.onError(mapRecognitionError(event.error));
  recognition.onend = handlers.onEnd;

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}
