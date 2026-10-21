import { describe, expect, it } from 'vitest';
import type { PackingItem } from './model';
import { filterItems, groupByCategory, progress } from './selectors';

const item = (id: string, overrides: Partial<PackingItem>): PackingItem => ({
  id,
  name: id,
  category: 'ski',
  ownership: 'have',
  packed: false,
  createdAt: 0,
  ...overrides,
});

const ITEMS = [
  item('helmet', { packed: true }),
  item('socks', { category: 'clothing', ownership: 'need-to-buy' }),
  item('charger', { category: 'electronics', packed: true, ownership: 'need-to-buy' }),
  item('goggles', {}),
];

describe('filterItems', () => {
  it('filters by category and status together', () => {
    expect(filterItems(ITEMS, { category: 'all', status: 'all' })).toHaveLength(4);
    expect(filterItems(ITEMS, { category: 'ski', status: 'to-pack' }).map((i) => i.id)).toEqual([
      'goggles',
    ]);
    expect(filterItems(ITEMS, { category: 'all', status: 'need-to-buy' }).map((i) => i.id)).toEqual(
      ['socks', 'charger'],
    );
    expect(filterItems(ITEMS, { category: 'all', status: 'packed' })).toHaveLength(2);
  });
});

describe('progress', () => {
  it('counts packed, total and need-to-buy', () => {
    expect(progress(ITEMS)).toEqual({ packed: 2, total: 4, needToBuy: 2 });
    expect(progress([])).toEqual({ packed: 0, total: 0, needToBuy: 0 });
  });
});

describe('groupByCategory', () => {
  it('uses the fixed category order and skips empty ones', () => {
    expect(groupByCategory(ITEMS).map((g) => g.category)).toEqual([
      'clothing',
      'electronics',
      'ski',
    ]);
  });
});
