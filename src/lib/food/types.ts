/** Georgian dishes and drinks for the Food page (data in src/data/dishes.ts). */

export const DISH_CATEGORIES = [
  'starters',
  'soups',
  'breads',
  'mains',
  'sauces',
  'sweets',
  'drinks',
] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<DishCategory, string> = {
  starters: 'Cold starters & salads',
  soups: 'Soups',
  breads: 'Breads & pastries',
  mains: 'Dumplings & mains',
  sauces: 'Sauces, sides & cheese',
  sweets: 'Sweets',
  drinks: 'Drinks',
};

export const CATEGORY_EMOJI: Record<DishCategory, string> = {
  starters: '🥗',
  soups: '🍲',
  breads: '🫓',
  mains: '🥟',
  sauces: '🧄',
  sweets: '🍯',
  drinks: '🍷',
};

/** 0 = not spicy … 3 = hot. */
export type SpicyLevel = 0 | 1 | 2 | 3;

export interface Diet {
  vegetarian: boolean;
  vegan: boolean;
  /** Contains walnuts, hazelnuts or other nuts as usually made. */
  nuts: boolean;
  spicy: SpicyLevel;
}

export interface Dish {
  /** URL slug: #/food/<id>. */
  id: string;
  /** Georgian (Mkhedruli), rendered with lang="ka". */
  nameKa: string;
  /** National system romanization, as in the Georgian words. */
  transliteration: string;
  /** The name as it appears on English menus, e.g. "Khinkali". */
  name: string;
  /** What it is, in English, e.g. "Soup dumplings". */
  nameEn: string;
  category: DishCategory;
  /** Our own words. */
  description: string;
  ingredients: string[];
  funFact?: string;
  region?: string;
  diet: Diet;
  /** Where the usual version varies (e.g. lard in the dough). */
  dietNote?: string;
  /** How to eat or order it. */
  howToEat?: string;
  sources: string[];
  /** Drawn on the illustration when there's no photo; defaults to the category emoji. */
  emoji?: string;
  /** Existing fun facts (src/data/facts.ts) to show on the dish page. */
  relatedFactIds?: string[];
}

export interface DishFilters {
  query: string;
  vegetarian: boolean;
  vegan: boolean;
  noNuts: boolean;
}

export const NO_FILTERS: DishFilters = {
  query: '',
  vegetarian: false,
  vegan: false,
  noNuts: false,
};
