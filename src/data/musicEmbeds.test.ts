import { describe, expect, it } from 'vitest';
import { MUSIC_EMBEDS } from './musicEmbeds';

describe('modern music embeds', () => {
  it('lists several official, distinct artists across genres', () => {
    expect(MUSIC_EMBEDS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(MUSIC_EMBEDS.map((e) => e.artist)).size).toBe(MUSIC_EMBEDS.length);
    expect(new Set(MUSIC_EMBEDS.map((e) => e.genre)).size).toBeGreaterThanOrEqual(4);
  });

  it.each(MUSIC_EMBEDS.map((e) => [e.artist, e] as const))(
    '%s has a valid YouTube id and channel',
    (_a, e) => {
      expect(e.id).toMatch(e.kind === 'playlist' ? /^PL[\w-]{16,32}$/ : /^[\w-]{11}$/);
      expect(e.channel.trim()).not.toBe('');
      expect(e.channel).not.toMatch(/ - Topic$/);
      expect(e.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );
});
