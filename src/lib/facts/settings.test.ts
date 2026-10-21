import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '../storage/safeStorage';
import { createFactSettings } from './settings';

describe('fact settings', () => {
  it('persists mute and notifies subscribers', () => {
    const store = createMemoryStore();
    const settings = createFactSettings(store);
    const listener = vi.fn();
    settings.subscribe(listener);
    expect(settings.isMuted()).toBe(false);
    settings.setMuted(true);
    expect(listener).toHaveBeenCalledWith(true);
    expect(createFactSettings(store).isMuted()).toBe(true);
  });

  it('records when the last fact was shown', () => {
    const settings = createFactSettings(createMemoryStore());
    expect(settings.lastShownAt()).toBeNull();
    settings.recordShown(123);
    expect(settings.lastShownAt()).toBe(123);
  });
});
