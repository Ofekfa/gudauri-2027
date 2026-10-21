import { describe, expect, it } from 'vitest';
import { CATEGORIES, MAX_ITEM_NAME_LENGTH } from '../lib/packing/model';
import { PACKING_TEMPLATE } from './packingTemplate';

describe('PACKING_TEMPLATE', () => {
  it('covers every category with unique, valid names', () => {
    const names = PACKING_TEMPLATE.map((i) => i.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const category of CATEGORIES) {
      expect(PACKING_TEMPLATE.some((i) => i.category === category)).toBe(true);
    }
    for (const { name } of PACKING_TEMPLATE)
      expect(name.length).toBeLessThanOrEqual(MAX_ITEM_NAME_LENGTH);
  });
});
