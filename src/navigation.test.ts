import { describe, expect, it } from 'vitest';
import {
  activeTabPath,
  findNavItem,
  MORE_GROUPS,
  MORE_ITEMS,
  NAV_GROUPS,
  SECTIONS,
  TAB_BAR_ITEMS,
} from './navigation';

describe('navigation', () => {
  it('keeps the primary nav (tab bar and desktop header) to five items, Home first and More last', () => {
    expect(TAB_BAR_ITEMS).toHaveLength(5);
    expect(TAB_BAR_ITEMS[0]?.path).toBe('/');
    expect(TAB_BAR_ITEMS.at(-1)?.path).toBe('/more');
  });

  it('highlights More for sections that live under it', () => {
    for (const item of MORE_ITEMS) expect(activeTabPath(item.path)).toBe('/more');
    for (const item of TAB_BAR_ITEMS) expect(activeTabPath(item.path)).toBe(item.path);
  });

  it('gives every section a known group and shows every More section in exactly one group', () => {
    for (const s of SECTIONS) expect(NAV_GROUPS).toContain(s.group);
    const grouped = MORE_GROUPS.flatMap((g) => g.items.map((i) => i.path));
    expect([...grouped].sort()).toEqual(MORE_ITEMS.map((i) => i.path).sort());
    expect(MORE_GROUPS.every((g) => g.items.length > 0)).toBe(true);
  });

  it('puts the Round 2 trip tools in the tab bar', () => {
    expect(TAB_BAR_ITEMS.map((i) => i.path)).toContain('/itinerary');
    expect(activeTabPath('/flights')).toBe('/more');
  });

  it('finds items by path', () => {
    expect(findNavItem('/flights')?.title).toBe('Flights');
    expect(findNavItem('/nope')).toBeUndefined();
  });
});
