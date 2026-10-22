import { describe, expect, it } from 'vitest';
import {
  filterDishes,
  groupByCategory,
  hasActiveFilters,
  normalize,
  searchDishes,
} from './selectors';
import { NO_FILTERS, type Dish } from './types';

const dish = (over: Partial<Dish> & Pick<Dish, 'id' | 'category'>): Dish => ({
  nameKa: 'ხინკალი',
  transliteration: over.id,
  name: over.id,
  nameEn: over.id,
  description: '',
  ingredients: [],
  diet: { vegetarian: false, vegan: false, nuts: false, spicy: 0 },
  sources: ['https://example.org'],
  ...over,
});

const DISHES: Dish[] = [
  dish({
    id: 'khinkali',
    category: 'mains',
    nameKa: 'ხინკალი',
    transliteration: 'khink’ali',
    nameEn: 'Khinkali dumplings',
    ingredients: ['minced meat'],
  }),
  dish({
    id: 'pkhali',
    category: 'starters',
    nameKa: 'ფხალი',
    transliteration: 'pkhali',
    nameEn: 'Pkhali',
    ingredients: ['spinach', 'walnuts'],
    diet: { vegetarian: true, vegan: true, nuts: true, spicy: 0 },
  }),
  dish({
    id: 'lobiani',
    category: 'breads',
    nameKa: 'ლობიანი',
    transliteration: 'lobiani',
    nameEn: 'Bean-filled bread',
    ingredients: ['kidney beans'],
    diet: { vegetarian: true, vegan: false, nuts: false, spicy: 0 },
  }),
  dish({
    id: 'tkemali',
    category: 'sauces',
    nameKa: 'ტყემალი',
    transliteration: 'tq’emali',
    nameEn: 'Sour plum sauce',
    ingredients: ['sour plums'],
    diet: { vegetarian: true, vegan: true, nuts: false, spicy: 1 },
  }),
];
const ids = (list: Dish[]) => list.map((d) => d.id);

describe('food search', () => {
  it('normalizes case, diacritics and apostrophes', () => {
    expect(normalize("  Tq'emali  ")).toBe('tqemali');
    expect(normalize('khink’ali')).toBe('khinkali');
    expect(normalize('Crème')).toBe('creme');
    expect(normalize('ხინკალი')).toBe('ხინკალი');
  });

  it('matches English, transliteration, Georgian and ingredients', () => {
    expect(ids(searchDishes(DISHES, 'dumpling'))).toEqual(['khinkali']);
    expect(ids(searchDishes(DISHES, "khink'ali"))).toEqual(['khinkali']);
    // The common spelling matches through the id even though the transliteration is tq’emali.
    expect(ids(searchDishes(DISHES, 'tkemali'))).toEqual(['tkemali']);
    expect(ids(searchDishes(DISHES, 'tqemali'))).toEqual(['tkemali']);
    expect(ids(searchDishes(DISHES, 'ფხალ'))).toEqual(['pkhali']);
    expect(ids(searchDishes(DISHES, 'walnut'))).toEqual(['pkhali']);
    expect(ids(searchDishes(DISHES, 'bean bread'))).toEqual(['lobiani']);
    expect(ids(searchDishes(DISHES, '   '))).toEqual(ids(DISHES));
  });
});

describe('food filters', () => {
  it('combines search with diet filters', () => {
    expect(ids(filterDishes(DISHES, { ...NO_FILTERS, vegetarian: true }))).toEqual([
      'pkhali',
      'lobiani',
      'tkemali',
    ]);
    expect(ids(filterDishes(DISHES, { ...NO_FILTERS, vegan: true }))).toEqual([
      'pkhali',
      'tkemali',
    ]);
    expect(ids(filterDishes(DISHES, { ...NO_FILTERS, vegan: true, noNuts: true }))).toEqual([
      'tkemali',
    ]);
    expect(ids(filterDishes(DISHES, { ...NO_FILTERS, query: 'plum', vegetarian: true }))).toEqual([
      'tkemali',
    ]);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, query: ' x ' })).toBe(true);
  });

  it('groups by category in menu order, skipping empty ones', () => {
    expect(groupByCategory(DISHES).map((g) => g.category)).toEqual([
      'starters',
      'breads',
      'mains',
      'sauces',
    ]);
  });
});
