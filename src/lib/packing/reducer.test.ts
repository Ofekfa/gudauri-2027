import { describe, expect, it } from 'vitest';
import { createEmptyState, MAX_ITEM_NAME_LENGTH, type PackingState } from './model';
import { packingReducer, type PackingAction } from './reducer';

const TRAVELERS = ['ofek', 'ron', 'roy', 'maya'] as const;
const NOW = 1_700_000_000_000;

function run(actions: PackingAction[], start: PackingState = createEmptyState(TRAVELERS)) {
  return actions.reduce(packingReducer, start);
}

const add = (id: string, name: string, traveler: 'ofek' | 'maya' = 'ofek'): PackingAction => ({
  type: 'add',
  traveler,
  id,
  now: NOW,
  item: { name, category: 'ski', ownership: 'have' },
});

describe('packingReducer', () => {
  it('adds a trimmed item to one traveler only', () => {
    const state = run([add('1', '  Ski   gloves ')]);
    expect(state.lists.ofek).toEqual([
      {
        id: '1',
        name: 'Ski gloves',
        category: 'ski',
        ownership: 'have',
        packed: false,
        createdAt: NOW,
      },
    ]);
    expect(state.lists.maya).toEqual([]);
  });

  it('ignores blank names and truncates very long ones', () => {
    const state = run([add('1', '   '), add('2', 'x'.repeat(200))]);
    expect(state.lists.ofek).toHaveLength(1);
    expect(state.lists.ofek[0]!.name).toHaveLength(MAX_ITEM_NAME_LENGTH);
  });

  it('renames, recategorises, toggles ownership and packed', () => {
    const state = run([
      add('1', 'Gloves'),
      { type: 'rename', traveler: 'ofek', id: '1', name: 'Warm gloves' },
      { type: 'setCategory', traveler: 'ofek', id: '1', category: 'clothing' },
      { type: 'toggleOwnership', traveler: 'ofek', id: '1' },
      { type: 'togglePacked', traveler: 'ofek', id: '1' },
    ]);
    expect(state.lists.ofek[0]).toMatchObject({
      name: 'Warm gloves',
      category: 'clothing',
      ownership: 'need-to-buy',
      packed: true,
    });
  });

  it('does not rename to an empty string', () => {
    const state = run([
      add('1', 'Gloves'),
      { type: 'rename', traveler: 'ofek', id: '1', name: ' ' },
    ]);
    expect(state.lists.ofek[0]!.name).toBe('Gloves');
  });

  it('removes and restores an item at its original position', () => {
    const base = run([add('1', 'A'), add('2', 'B'), add('3', 'C')]);
    const removed = packingReducer(base, { type: 'remove', traveler: 'ofek', id: '2' });
    expect(removed.lists.ofek.map((i) => i.name)).toEqual(['A', 'C']);
    const restored = packingReducer(removed, {
      type: 'restore',
      traveler: 'ofek',
      item: base.lists.ofek[1]!,
      index: 1,
    });
    expect(restored.lists.ofek.map((i) => i.name)).toEqual(['A', 'B', 'C']);
  });

  it('returns the same state object for no-op updates', () => {
    const base = run([add('1', 'A')]);
    expect(packingReducer(base, { type: 'togglePacked', traveler: 'ofek', id: 'nope' })).toBe(base);
  });

  it('applies the template without duplicating existing names and marks it decided', () => {
    const base = run([add('1', 'Goggles')]);
    const state = packingReducer(base, {
      type: 'applyTemplate',
      traveler: 'ofek',
      now: NOW,
      ids: ['t1', 't2'],
      items: [
        { name: 'goggles', category: 'ski', ownership: 'have' },
        { name: 'Sunscreen', category: 'essentials', ownership: 'need-to-buy' },
      ],
    });
    expect(state.lists.ofek.map((i) => i.name)).toEqual(['Goggles', 'Sunscreen']);
    expect(state.templateDecided.ofek).toBe(true);
    expect(state.templateDecided.maya).toBe(false);
  });

  it('records skipping the template', () => {
    const state = run([{ type: 'skipTemplate', traveler: 'maya' }]);
    expect(state.templateDecided.maya).toBe(true);
  });
});
