import { describe, expect, it } from 'vitest';
import { DISH_CATEGORIES } from '../lib/food/types';
import { isWordFact } from '../lib/facts/types';
import { DISHES, findDish, ORDERING_PHRASE_IDS } from './dishes';
import { FACTS } from './facts';

/** Mkhedruli letters plus spaces (dish names have no punctuation). */
const MKHEDRULI = /^[ა-ჿ ]+$/;
/** National-system romanization as in words.ts: lowercase letters, ’ for ejectives, spaces. */
const TRANSLITERATION = /^[a-z’ ]+$/;
const SLUG = /^[a-z]+(-[a-z]+)*$/;
const MAX_DESCRIPTION = 280;

describe('dishes', () => {
  it('has 35–40 dishes with unique slug ids', () => {
    expect(DISHES.length).toBeGreaterThanOrEqual(35);
    expect(DISHES.length).toBeLessThanOrEqual(40);
    const ids = DISHES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SLUG);
    expect(findDish('khinkali')?.name).toBe('Khinkali');
    expect(findDish('nope')).toBeUndefined();
  });

  it('fills every category', () => {
    for (const category of DISH_CATEGORIES) {
      expect(DISHES.filter((d) => d.category === category).length, category).toBeGreaterThan(0);
    }
  });

  it.each(DISHES.map((d) => [d.id, d] as const))('%s is complete and well-formed', (_id, dish) => {
    expect(dish.nameKa).toMatch(MKHEDRULI);
    expect(dish.transliteration).toMatch(TRANSLITERATION);
    expect(dish.nameEn.trim()).not.toBe('');
    expect(dish.name).toMatch(/^[A-Z][a-z]+( [a-z]+)*$/);
    expect(dish.description.length).toBeGreaterThan(30);
    expect(dish.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(dish.ingredients.length).toBeGreaterThan(0);
    expect(dish.sources.length).toBeGreaterThanOrEqual(2);
    for (const source of dish.sources) expect(source).toMatch(/^https:\/\/\S+$/);
    // Vegan food is vegetarian; spicy is a 0–3 scale.
    if (dish.diet.vegan) expect(dish.diet.vegetarian).toBe(true);
    // A vegetarian option only makes sense for dishes that aren't vegetarian, and needs explaining.
    if (dish.diet.vegetarianOption) {
      expect(dish.diet.vegetarian).toBe(false);
      expect(dish.dietNote).toBeTruthy();
    }
    expect([0, 1, 2, 3]).toContain(dish.diet.spicy);
  });

  it('links only to fun facts that exist, without repeating them', () => {
    const factIds = new Set(FACTS.map((f) => f.id));
    for (const dish of DISHES) {
      for (const id of dish.relatedFactIds ?? [])
        expect(factIds.has(id), `${dish.id} → ${id}`).toBe(true);
    }
  });

  it('reuses existing Georgian words for ordering phrases', () => {
    for (const id of ORDERING_PHRASE_IDS) {
      const fact = FACTS.find((f) => f.id === id);
      expect(fact && isWordFact(fact), id).toBe(true);
    }
  });
});
