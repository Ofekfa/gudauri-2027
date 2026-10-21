import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../storage/safeStorage';
import { parseImport, serializeExport, validateState } from './importExport';
import { createEmptyState } from './model';
import { createLocalPackingRepository, PACKING_STORAGE_KEY } from './repository';

const TRAVELERS = ['ofek', 'ron', 'roy', 'maya'] as const;

function sampleState() {
  const state = createEmptyState(TRAVELERS);
  state.lists.maya = [
    { id: 'a', name: 'Goggles', category: 'ski', ownership: 'have', packed: true, createdAt: 1 },
  ];
  state.templateDecided.maya = true;
  return state;
}

describe('export/import', () => {
  it('round-trips', () => {
    const text = serializeExport(sampleState(), new Date('2027-01-01T00:00:00Z'));
    expect(parseImport(text, TRAVELERS)).toEqual({ ok: true, state: sampleState() });
  });

  it('rejects invalid JSON and foreign files', () => {
    expect(parseImport('{nope', TRAVELERS)).toMatchObject({ ok: false });
    expect(parseImport(JSON.stringify({ app: 'other', data: {} }), TRAVELERS)).toMatchObject({
      ok: false,
    });
  });

  it('skips invalid and duplicate items, drops unknown travelers, fills missing ones', () => {
    const result = validateState(
      {
        version: 1,
        lists: {
          ofek: [
            {
              id: 'x',
              name: 'Ok',
              category: 'ski',
              ownership: 'have',
              packed: false,
              createdAt: 0,
            },
            { id: 'x', name: 'Dup', category: 'ski', ownership: 'have' },
            { id: 'y', name: 'Bad category', category: 'weapons', ownership: 'have' },
            { id: 'z', name: '   ', category: 'ski', ownership: 'have' },
            'garbage',
          ],
          stranger: [{ id: 'q', name: 'Hi', category: 'ski', ownership: 'have' }],
        },
      },
      TRAVELERS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lists.ofek.map((i) => i.name)).toEqual(['Ok']);
    expect(result.state.lists.maya).toEqual([]);
    expect(Object.keys(result.state.lists)).toEqual([...TRAVELERS]);
    // A traveler with items has effectively decided about the template.
    expect(result.state.templateDecided.ofek).toBe(true);
  });

  it('rejects a different version', () => {
    expect(validateState({ version: 2, lists: {} }, TRAVELERS)).toMatchObject({ ok: false });
  });
});

describe('local repository', () => {
  it('saves and loads', async () => {
    const repo = createLocalPackingRepository(createMemoryStore(), TRAVELERS);
    await repo.save(sampleState());
    expect(await repo.load()).toEqual(sampleState());
  });

  it('falls back to an empty state when stored data is corrupt', async () => {
    const store = createMemoryStore();
    store.set(PACKING_STORAGE_KEY, '{corrupt');
    const repo = createLocalPackingRepository(store, TRAVELERS);
    expect(await repo.load()).toEqual(createEmptyState(TRAVELERS));
  });
});
