import { describe, expect, it } from 'vitest';
import type { Webcam } from '../../data/zones';
import {
  YOUTUBE_EMBED_ORIGIN,
  playerErrorCode,
  webcamEmbedUrl,
  webcamThumbnailUrl,
  webcamWatchUrl,
} from './webcam';

const cam: Webcam = {
  provider: 'youtube',
  id: '7uoyrER_QB4',
  label: 'Kudebi',
  checkedOn: '2026-11-15',
};
const ORIGIN = 'https://ofekfa.github.io';

describe('webcamEmbedUrl', () => {
  const url = new URL(webcamEmbedUrl(cam, ORIGIN));

  it('uses the privacy-enhanced embed for the video id', () => {
    expect(url.origin).toBe('https://www.youtube-nocookie.com');
    expect(url.pathname).toBe('/embed/7uoyrER_QB4');
  });

  it('is always muted and plays inline', () => {
    expect(url.searchParams.get('mute')).toBe('1');
    expect(url.searchParams.get('autoplay')).toBe('1');
    expect(url.searchParams.get('playsinline')).toBe('1');
  });

  it('enables the IFrame API for our origin so errors can be detected', () => {
    expect(url.searchParams.get('enablejsapi')).toBe('1');
    expect(url.searchParams.get('origin')).toBe(ORIGIN);
  });
});

describe('webcam links', () => {
  it('builds the watch and thumbnail URLs', () => {
    expect(webcamWatchUrl(cam)).toBe('https://www.youtube.com/watch?v=7uoyrER_QB4');
    expect(webcamThumbnailUrl(cam)).toBe('https://i.ytimg.com/vi/7uoyrER_QB4/hqdefault.jpg');
  });
});

describe('playerErrorCode', () => {
  const msg = (o: unknown) => JSON.stringify(o);

  it('reads the error code from a player onError message', () => {
    expect(playerErrorCode(YOUTUBE_EMBED_ORIGIN, msg({ event: 'onError', info: 150 }))).toBe(150);
    expect(playerErrorCode(YOUTUBE_EMBED_ORIGIN, msg({ event: 'onError', info: '100' }))).toBe(100);
  });

  it('ignores other events, origins and junk', () => {
    expect(playerErrorCode(YOUTUBE_EMBED_ORIGIN, msg({ event: 'onReady' }))).toBeNull();
    expect(
      playerErrorCode('https://evil.example', msg({ event: 'onError', info: 150 })),
    ).toBeNull();
    expect(playerErrorCode(YOUTUBE_EMBED_ORIGIN, 'not json')).toBeNull();
    expect(playerErrorCode(YOUTUBE_EMBED_ORIGIN, { event: 'onError' })).toBeNull();
    expect(playerErrorCode(YOUTUBE_EMBED_ORIGIN, 'null')).toBeNull();
  });
});
