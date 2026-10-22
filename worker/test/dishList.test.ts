import { describe, expect, it } from 'vitest';
import { DISHES } from '../../src/data/dishes';
import { buildDishList, dishLine } from '../src/dishList';
import { DISH_LIST_MAX_CHARS } from '../src/limits';
import { buildSystemPrompt } from '../src/prompt';

const byId = (id: string) => DISHES.find((d) => d.id === id)!;

describe('dish list for the assistant', () => {
  it('lists every dish within the budget', () => {
    const list = buildDishList();
    expect(list.length).toBeLessThanOrEqual(DISH_LIST_MAX_CHARS);
    expect(list.split('\n')).toHaveLength(DISHES.length);
  });

  it('gives names, descriptions, regions and usual diet', () => {
    expect(dishLine(byId('kubdari'))).toBe('- Kubdari: Svan meat pie, Svaneti (not vegetarian)');
    expect(dishLine(byId('pkhali'))).toContain('(vegan, nuts)');
    expect(dishLine(byId('ajika'))).toContain('spicy');
    expect(dishLine(byId('lobiani'))).toContain('usually meat; vegetarian versions exist');
    expect(dishLine(byId('qvevri-wine'))).not.toMatch(/Qvevri wine: Qvevri wine/);
  });

  it('keeps whole lines when the budget is tight', () => {
    const list = buildDishList(DISHES, 200);
    expect(list.length).toBeLessThanOrEqual(200);
    expect(list.split('\n').every((line) => line.endsWith(')'))).toBe(true);
  });

  it('is part of the system prompt', () => {
    const prompt = buildSystemPrompt(new Date('2026-10-22T00:00:00Z'));
    expect(prompt).toContain('- Khinkali: Soup dumplings');
    expect(prompt).toContain("site's Food page");
  });
});
