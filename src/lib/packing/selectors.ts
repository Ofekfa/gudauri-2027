import { CATEGORIES, type Category, type PackingItem } from './model';

export type CategoryFilter = Category | 'all';
export const STATUS_FILTERS = ['all', 'to-pack', 'packed', 'need-to-buy', 'have'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'All',
  'to-pack': 'To pack',
  packed: 'Packed',
  'need-to-buy': 'Need to buy',
  have: 'Already have',
};

export interface Filters {
  category: CategoryFilter;
  status: StatusFilter;
}

const matchesStatus = (item: PackingItem, status: StatusFilter) => {
  switch (status) {
    case 'all':
      return true;
    case 'to-pack':
      return !item.packed;
    case 'packed':
      return item.packed;
    case 'need-to-buy':
    case 'have':
      return item.ownership === status;
  }
};

export function filterItems(items: PackingItem[], filters: Filters): PackingItem[] {
  return items.filter(
    (item) =>
      (filters.category === 'all' || item.category === filters.category) &&
      matchesStatus(item, filters.status),
  );
}

export interface Progress {
  packed: number;
  total: number;
  needToBuy: number;
}

export function progress(items: PackingItem[]): Progress {
  return {
    packed: items.filter((i) => i.packed).length,
    total: items.length,
    needToBuy: items.filter((i) => i.ownership === 'need-to-buy').length,
  };
}

/** Groups in the fixed category order, skipping empty categories. */
export function groupByCategory(
  items: PackingItem[],
): { category: Category; items: PackingItem[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((group) => group.items.length > 0);
}
