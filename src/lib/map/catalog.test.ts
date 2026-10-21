import { describe, expect, it } from 'vitest';
import pistes from '../../data/pistes.json';
import { formatLength, groupRuns } from './catalog';
import type { MapRun, PisteMap } from './types';

const run = (id: string, name: string | null, difficulty: MapRun['difficulty'], lengthM = 100) => ({
  id,
  name,
  difficulty,
  lengthM,
  path: 'M0 0L1 1',
});

describe('groupRuns', () => {
  it('merges segments that share a name and difficulty', () => {
    const groups = groupRuns([run('a', 'Kudebi 1', 'easy'), run('b', 'Kudebi 1', 'easy', 50)]);
    expect(groups).toEqual([
      expect.objectContaining({ name: 'Kudebi 1', lengthM: 150, runIds: ['a', 'b'] }),
    ]);
  });

  it('keeps unnamed runs separate and sorts easiest first, then by name', () => {
    const groups = groupRuns([
      run('x', 'Sadzele 2', 'intermediate'),
      run('y', null, 'easy'),
      run('z', null, 'easy'),
      run('w', 'Sadzele 10', 'intermediate'),
      run('v', 'Pirveli', 'novice'),
    ]);
    expect(groups.map((g) => g.name)).toEqual(['Pirveli', null, null, 'Sadzele 2', 'Sadzele 10']);
  });

  it('handles the real Gudauri data', () => {
    const groups = groupRuns((pistes as PisteMap).runs);
    expect(groups.length).toBeGreaterThan(20);
  });
});

describe('formatLength', () => {
  it('formats meters and kilometers', () => {
    expect(formatLength(987)).toBe('990 m');
    expect(formatLength(2367)).toBe('2.4 km');
  });
});
