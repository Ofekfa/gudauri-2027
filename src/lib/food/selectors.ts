import { DISH_CATEGORIES, type Dish, type DishCategory, type DishFilters } from './types';

/**
 * Lower-cases, strips diacritics and apostrophes (’ ' ʼ) so "khink'ali",
 * "khinkali" and "Khinkali" all match. Georgian script passes through.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[’'ʼ`]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function haystack(dish: Dish): string {
  return normalize(
    [
      dish.nameEn,
      dish.transliteration,
      dish.nameKa,
      dish.id.replace(/-/g, ' '),
      ...dish.ingredients,
    ].join(' | '),
  );
}

export function searchDishes(dishes: readonly Dish[], query: string): Dish[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (terms.length === 0) return [...dishes];
  return dishes.filter((dish) => {
    const text = haystack(dish);
    return terms.every((term) => text.includes(term));
  });
}

export function filterDishes(dishes: readonly Dish[], filters: DishFilters): Dish[] {
  return searchDishes(dishes, filters.query).filter(
    ({ diet }) =>
      (!filters.vegetarian || diet.vegetarian) &&
      (!filters.vegan || diet.vegan) &&
      (!filters.noNuts || !diet.nuts),
  );
}

export const hasActiveFilters = (f: DishFilters) =>
  Boolean(f.query.trim()) || f.vegetarian || f.vegan || f.noNuts;

/** Category sections in menu order, skipping empty ones. */
export function groupByCategory(
  dishes: readonly Dish[],
): { category: DishCategory; dishes: Dish[] }[] {
  return DISH_CATEGORIES.map((category) => ({
    category,
    dishes: dishes.filter((d) => d.category === category),
  })).filter((group) => group.dishes.length > 0);
}
