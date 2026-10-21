import { describe, expect, it } from 'vitest';
import { createMemoryStore } from './safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from './versioned';

interface Notes {
  version: 3;
  items: string[];
}

const spec: VersionedSpec<Notes> = {
  key: 'notes',
  version: 3,
  migrations: {
    // v1 stored a single string, v2 an array under "list"
    1: (raw) => ({ list: [raw.text] }),
    2: (raw) => ({ items: raw.list }),
  },
  validate: (raw) =>
    typeof raw === 'object' &&
    raw !== null &&
    Array.isArray((raw as Notes).items) &&
    (raw as Notes).items.every((i) => typeof i === 'string')
      ? { version: 3, items: (raw as Notes).items }
      : null,
  empty: () => ({ version: 3, items: [] }),
};

describe('versioned storage', () => {
  it('returns empty when nothing is stored', () => {
    expect(loadVersioned(createMemoryStore(), spec)).toEqual({
      value: { version: 3, items: [] },
      status: 'empty',
    });
  });

  it('round-trips the current version', () => {
    const store = createMemoryStore();
    saveVersioned(store, spec, { version: 3, items: ['a'] });
    expect(loadVersioned(store, spec)).toEqual({
      value: { version: 3, items: ['a'] },
      status: 'ok',
    });
  });

  it('runs the migration chain from old versions', () => {
    const store = createMemoryStore();
    store.set('notes', JSON.stringify({ version: 1, text: 'hello' }));
    expect(loadVersioned(store, spec)).toEqual({
      value: { version: 3, items: ['hello'] },
      status: 'migrated',
    });
  });

  it('treats corrupt or unversioned data as corrupt', () => {
    const store = createMemoryStore();
    store.set('notes', '{nope');
    expect(loadVersioned(store, spec).status).toBe('corrupt');
    store.set('notes', JSON.stringify({ items: ['no version'] }));
    expect(loadVersioned(store, spec).status).toBe('corrupt');
    store.set('notes', JSON.stringify({ version: 3, items: [1, 2] }));
    expect(loadVersioned(store, spec).status).toBe('corrupt');
  });

  it('flags data from a newer version without migrating it', () => {
    const store = createMemoryStore();
    store.set('notes', JSON.stringify({ version: 9, whatever: true }));
    expect(loadVersioned(store, spec)).toEqual({
      value: { version: 3, items: [] },
      status: 'future',
    });
  });

  it('refuses to save data at the wrong version', () => {
    const wrong = { version: 2, items: [] } as unknown as Notes;
    expect(() => saveVersioned(createMemoryStore(), spec, wrong)).toThrow();
  });
});
