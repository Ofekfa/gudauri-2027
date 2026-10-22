import { describe, expect, it } from 'vitest';
import { emptyBag, MAX_ERA_RUN, nextTrack, type BagState, type BagTrack } from './shuffleBag';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 3 artists × 2 eras, uneven like the real library.
const TRACKS: BagTrack[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `chant-${i}`,
    artist: 'Choir',
    era: 'traditional' as const,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `folk-${i}`,
    artist: 'Folk',
    era: 'traditional' as const,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `piano-${i}`,
    artist: 'Piano',
    era: 'modern' as const,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `techno-${i}`,
    artist: 'Techno',
    era: 'modern' as const,
  })),
];

function play(n: number, random: () => number, start: BagState = emptyBag(), tracks = TRACKS) {
  let state = start;
  const picks: BagTrack[] = [];
  for (let i = 0; i < n; i++) {
    const next = nextTrack(state, tracks, random);
    picks.push(next.track);
    state = next.state;
  }
  return { picks, state };
}

describe('music shuffle bag', () => {
  it('plays every track exactly once per cycle, for many cycles', () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const { picks } = play(TRACKS.length * 5, seeded(seed));
      for (let c = 0; c < 5; c++) {
        const cycle = picks.slice(c * TRACKS.length, (c + 1) * TRACKS.length).map((t) => t.id);
        expect(new Set(cycle).size, `seed ${seed} cycle ${c}`).toBe(TRACKS.length);
      }
    }
  });

  it('avoids the same artist back to back', () => {
    for (const seed of [1, 2, 3, 7, 13, 42, 99]) {
      const { picks } = play(TRACKS.length * 5, seeded(seed));
      const repeats = picks.filter((t, i) => i > 0 && picks[i - 1]!.artist === t.artist).length;
      expect(repeats, `seed ${seed}`).toBe(0);
    }
  });

  it('keeps either era from dominating a stretch', () => {
    const { picks } = play(TRACKS.length * 5, seeded(5));
    let longest = 1;
    let run = 1;
    for (let i = 1; i < picks.length; i++) {
      run = picks[i]!.era === picks[i - 1]!.era ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThanOrEqual(MAX_ERA_RUN + 3);
  });

  it('survives a reload: the serialized state continues the same cycle', () => {
    const random = seeded(11);
    const first = play(7, random);
    const restored = JSON.parse(JSON.stringify(first.state)) as BagState;
    const rest = play(TRACKS.length - 7, random, restored);
    const cycle = [...first.picks, ...rest.picks].map((t) => t.id);
    expect(new Set(cycle).size).toBe(TRACKS.length);
    expect(rest.picks[0]!.artist).not.toBe(first.picks[6]!.artist);
  });

  it('copes with tracks added or removed between versions', () => {
    const random = seeded(3);
    const { state } = play(5, random);
    const fewer = TRACKS.filter((t) => t.id !== state.remaining[0]);
    const next = nextTrack(state, fewer, random);
    expect(fewer.map((t) => t.id)).toContain(next.track.id);
    expect(() => nextTrack(emptyBag(), [], random)).toThrow();
  });
});
