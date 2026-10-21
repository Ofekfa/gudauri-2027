import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../lib/storage/safeStorage';
import { insertHighScore, loadHighScores, saveHighScores } from './highScores';

describe('insertHighScore', () => {
  it('keeps the top scores sorted and reports the rank', () => {
    let list = [] as ReturnType<typeof insertHighScore>['list'];
    for (const [score, at] of [
      [100, 1],
      [300, 2],
      [200, 3],
    ]) {
      list = insertHighScore(list, { score: score!, at: at! }).list;
    }
    expect(list.map((s) => s.score)).toEqual([300, 200, 100]);
    expect(insertHighScore(list, { score: 250, at: 4 }).rank).toBe(1);
  });

  it('drops scores beyond the limit and ignores zero', () => {
    const full = [5, 4, 3, 2, 1].map((score, at) => ({ score: score * 100, at }));
    expect(insertHighScore(full, { score: 50, at: 9 }).rank).toBe(-1);
    expect(insertHighScore(full, { score: 0, at: 9 }).rank).toBe(-1);
  });

  it('breaks ties in favour of the earlier score', () => {
    const { rank } = insertHighScore([{ score: 100, at: 1 }], { score: 100, at: 2 });
    expect(rank).toBe(1);
  });
});

describe('high score storage', () => {
  it('round-trips and survives corrupt data', () => {
    const store = createMemoryStore();
    saveHighScores(store, { maya: [{ score: 420, at: 1 }] });
    expect(loadHighScores(store)).toEqual({ maya: [{ score: 420, at: 1 }] });
    store.set('game:highScores', '{oops');
    expect(loadHighScores(store)).toEqual({});
  });
});
