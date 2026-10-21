import { describe, expect, it } from 'vitest';
import { createRecognizer, isRecognitionSupported, mapRecognitionError } from './recognition';

describe('speech recognition wrapper', () => {
  it('degrades gracefully when the API is missing (e.g. Firefox)', () => {
    expect(isRecognitionSupported()).toBe(false);
    expect(
      createRecognizer({
        onInterim: () => {},
        onFinal: () => {},
        onError: () => {},
        onEnd: () => {},
      }),
    ).toBeNull();
  });

  it('maps browser error codes to friendly categories', () => {
    expect(mapRecognitionError('not-allowed')).toBe('not-allowed');
    expect(mapRecognitionError('service-not-allowed')).toBe('not-allowed');
    expect(mapRecognitionError('no-speech')).toBe('no-speech');
    expect(mapRecognitionError('network')).toBe('network');
    expect(mapRecognitionError('audio-capture')).toBe('other');
  });
});
