/**
 * A compact, verified list of Georgian dishes for the system prompt, so the
 * small model talks about real dishes and gets diet questions right.
 */
import { DISHES } from '../../src/data/dishes';
import type { Dish } from '../../src/lib/food/types';
import { DISH_LIST_MAX_CHARS } from './limits';

function dietTag(dish: Dish): string {
  const { vegan, vegetarian, nuts, spicy, vegetarianOption } = dish.diet;
  const base = vegan ? 'vegan' : vegetarian ? 'vegetarian' : 'not vegetarian';
  const tags = [vegetarianOption ? 'often contains meat; vegetarian versions exist' : base];
  if (nuts) tags.push('nuts');
  if (spicy >= 2) tags.push('spicy');
  return tags.join(', ');
}

export function dishLine(dish: Dish): string {
  const parts = [
    dish.nameEn.toLowerCase() === dish.name.toLowerCase() ? null : dish.nameEn,
    dish.region,
  ]
    .filter(Boolean)
    .join(', ');
  return `- ${dish.name}${parts ? `: ${parts}` : ''} (${dietTag(dish)})`;
}

/** One line per dish, whole lines only, within the budget. */
export function buildDishList(dishes: readonly Dish[] = DISHES, max = DISH_LIST_MAX_CHARS): string {
  const lines: string[] = [];
  let used = 0;
  for (const line of dishes.map(dishLine)) {
    if (used + line.length + 1 > max) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}
