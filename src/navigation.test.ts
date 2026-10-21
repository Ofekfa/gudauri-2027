import { describe, expect, it } from 'vitest';
import { activeTabPath, findNavItem, TAB_BAR_ITEMS } from './navigation';

describe('navigation', () => {
  it('keeps the mobile tab bar to five items with Home first and More last', () => {
    expect(TAB_BAR_ITEMS).toHaveLength(5);
    expect(TAB_BAR_ITEMS[0]?.path).toBe('/');
    expect(TAB_BAR_ITEMS.at(-1)?.path).toBe('/more');
  });

  it('highlights More for sections that live under it', () => {
    expect(activeTabPath('/map')).toBe('/more');
    expect(activeTabPath('/flights')).toBe('/flights');
  });

  it('finds items by path', () => {
    expect(findNavItem('/flights')?.title).toBe('Flights');
    expect(findNavItem('/nope')).toBeUndefined();
  });
});
