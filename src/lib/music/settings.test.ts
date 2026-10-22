import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../storage/safeStorage';
import {
  DEFAULT_VOLUME,
  loadMusicSettings,
  prefersNoAutoMusic,
  saveMusicSettings,
} from './settings';

describe('music settings', () => {
  it('defaults to on for first-time visitors', () => {
    expect(loadMusicSettings(undefined, createMemoryStore())).toMatchObject({
      enabled: true,
      volume: DEFAULT_VOLUME,
      chosen: false,
    });
  });

  it('starts muted on Save-Data or 2G-class connections, until the visitor chooses', () => {
    const store = createMemoryStore();
    expect(prefersNoAutoMusic({ saveData: true })).toBe(true);
    expect(prefersNoAutoMusic({ effectiveType: 'slow-2g' })).toBe(true);
    expect(prefersNoAutoMusic({ effectiveType: '4g' })).toBe(false);
    const first = loadMusicSettings({ saveData: true }, store);
    expect(first.enabled).toBe(false);
    saveMusicSettings({ enabled: true }, first, store);
    expect(loadMusicSettings({ saveData: true }, store).enabled).toBe(true);
  });

  it('remembers mute and volume across visits', () => {
    const store = createMemoryStore();
    let s = loadMusicSettings(undefined, store);
    s = saveMusicSettings({ enabled: false }, s, store);
    saveMusicSettings({ volume: 0.25 }, s, store);
    expect(loadMusicSettings(undefined, store)).toMatchObject({
      enabled: false,
      volume: 0.25,
      chosen: true,
    });
  });

  it('a volume change alone is not a mute/unmute choice', () => {
    const store = createMemoryStore();
    saveMusicSettings({ volume: 2 }, loadMusicSettings(undefined, store), store);
    expect(loadMusicSettings({ saveData: true }, store)).toMatchObject({
      enabled: false,
      volume: 1,
    });
  });

  it('ignores corrupt or future-version records', () => {
    const store = createMemoryStore();
    store.set('music:settings', '{not json');
    expect(loadMusicSettings(undefined, store).enabled).toBe(true);
    store.set('music:settings', JSON.stringify({ version: 99, enabled: false }));
    expect(loadMusicSettings(undefined, store).enabled).toBe(true);
  });
});
