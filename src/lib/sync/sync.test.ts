import { describe, expect, it } from 'vitest';
import { applySync, memoryRecordStore } from '../../../worker/src/sync/recordStore';
import { createEmptyState, type PackingItem, type PackingState } from '../packing/model';
import { createMemoryStore } from '../storage/safeStorage';
import { createEmptyTodoState } from '../todo/model';
import { itemKey, packingAdapter, todoAdapter } from './adapters';
import { parseSyncRequest } from './protocol';
import { applyChanges, canonicalJson, diffRecords } from './records';
import { syncDoc } from './syncClient';

const TRAVELERS = ['ofek', 'ron', 'roy', 'maya'] as const;
const item = (id: string, name: string, createdAt = 1): PackingItem => ({
  id,
  name,
  category: 'ski',
  ownership: 'have',
  packed: false,
  createdAt,
});
const withItems = (
  list: (typeof TRAVELERS)[number],
  items: PackingItem[],
  base = createEmptyState([...TRAVELERS]),
): PackingState => ({
  ...base,
  lists: { ...base.lists, [list]: items },
  templateDecided: { ...base.templateDecided, [list]: true },
});

/** A fake Worker: the real merge rules behind fetch, with a hook to act mid-request. */
function server(code = 'secret-code') {
  const store = memoryRecordStore();
  let during: (() => void) | null = null;
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    if ((init.headers as Record<string, string>).Authorization !== `Bearer ${code}`)
      return new Response('{}', { status: 401 });
    const parsed = parseSyncRequest(JSON.parse(String(init.body)));
    if (typeof parsed === 'string') return new Response('{}', { status: 400 });
    during?.();
    during = null;
    return new Response(JSON.stringify(applySync(store, parsed)));
  }) as unknown as typeof fetch;
  return { fetchImpl, duringNextRequest: (fn: () => void) => (during = fn) };
}

/** A phone: its own storage and state. */
function phone(
  me: (typeof TRAVELERS)[number],
  initial: PackingState,
  fetchImpl: typeof fetch,
  code = 'secret-code',
) {
  const store = createMemoryStore();
  let state = initial;
  return {
    get state() {
      return state;
    },
    edit(next: PackingState) {
      state = next;
    },
    async sync() {
      const outcome = await syncDoc({
        adapter: packingAdapter,
        getState: () => state,
        url: 'https://w',
        code,
        me,
        store,
        fetchImpl,
      });
      if (outcome.status === 'synced' && outcome.state) state = outcome.state;
      return outcome;
    },
  };
}

describe('records', () => {
  it('canonical JSON ignores key order and undefined fields', () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, 'x'] } })).toBe(
      '{"a":{"c":[2,"x"]},"b":1}',
    );
  });

  it('diffs and applies changes, deletions as null', () => {
    const base = new Map([
      ['a', '1'],
      ['b', '2'],
    ]);
    const current = new Map([
      ['a', '1'],
      ['b', '3'],
      ['c', '4'],
    ]);
    expect(diffRecords(base, current)).toEqual([
      { key: 'b', value: '3' },
      { key: 'c', value: '4' },
    ]);
    expect(diffRecords(current, base)).toEqual([
      { key: 'b', value: '2' },
      { key: 'c', value: null },
    ]);
    expect(applyChanges(base, diffRecords(base, current))).toEqual(current);
  });
});

describe('adapters', () => {
  it('round-trip packing and to-do state, keeping order', () => {
    const state = withItems('maya', [item('z-9', 'Goggles', 5), item('a-1', 'Helmet', 9)]);
    const back = packingAdapter.fromRecords(packingAdapter.toRecords(state), state);
    expect(back.lists.maya.map((i) => i.id)).toEqual(['z-9', 'a-1']);
    expect(back.templateDecided.maya).toBe(true);
    const todo = createEmptyTodoState();
    todo.lists.shared = [
      { id: 't1', title: 'Book transfer', done: false, category: 'flight', createdAt: 1 },
    ];
    expect(todoAdapter.fromRecords(todoAdapter.toRecords(todo), todo).lists.shared).toEqual(
      todo.lists.shared,
    );
  });

  it('skips malformed records and keeps unsyncable local items', () => {
    const local = withItems('ofek', [item('odd id!', 'From an old backup')]);
    const records = packingAdapter.toRecords(local);
    expect(records.size).toBe(1); // only the template flag
    records.set(itemKey('ofek', 'bad'), '{"id":"bad","name":42}');
    records.set(itemKey('ofek', 'mismatch'), canonicalJson(item('other', 'Wrong key')));
    const back = packingAdapter.fromRecords(records, local);
    expect(back.lists.ofek.map((i) => i.id)).toEqual(['odd id!']);
  });
});

describe('syncing phones', () => {
  it('shares items between phones and propagates deletions', async () => {
    const { fetchImpl } = server();
    const ofek = phone('ofek', withItems('ofek', [item('g1', 'Gloves')]), fetchImpl);
    const maya = phone('maya', createEmptyState([...TRAVELERS]), fetchImpl);
    await ofek.sync();
    const got = await maya.sync();
    expect(maya.state.lists.ofek.map((i) => i.name)).toEqual(['Gloves']);
    expect(got.status === 'synced' && got.by[itemKey('ofek', 'g1')]).toBe('ofek');
    maya.edit(withItems('ofek', [], maya.state));
    await maya.sync();
    await ofek.sync();
    expect(ofek.state.lists.ofek).toEqual([]);
  });

  it('merges what each phone had before the first sync', async () => {
    const { fetchImpl } = server();
    const ofek = phone('ofek', withItems('ofek', [item('g1', 'Gloves')]), fetchImpl);
    const ron = phone('ron', withItems('ron', [item('h1', 'Helmet')]), fetchImpl);
    await ofek.sync();
    await ron.sync();
    await ofek.sync();
    expect(ofek.state.lists.ron.map((i) => i.name)).toEqual(['Helmet']);
    expect(ron.state.lists.ofek.map((i) => i.name)).toEqual(['Gloves']);
  });

  it('keeps an edit made while a sync was in flight, and sends it next time', async () => {
    const srv = server();
    const ofek = phone('ofek', withItems('ofek', [item('g1', 'Gloves')]), srv.fetchImpl);
    const maya = phone('maya', createEmptyState([...TRAVELERS]), srv.fetchImpl);
    await ofek.sync();
    srv.duringNextRequest(() =>
      ofek.edit(withItems('ofek', [{ ...item('g1', 'Gloves'), packed: true }], ofek.state)),
    );
    await ofek.sync();
    expect(ofek.state.lists.ofek[0]!.packed).toBe(true);
    await ofek.sync();
    await maya.sync();
    expect(maya.state.lists.ofek[0]!.packed).toBe(true);
  });

  it('the later change wins when two phones edit the same item', async () => {
    const { fetchImpl } = server();
    const ofek = phone('ofek', withItems('maya', [item('m1', 'Goggles')]), fetchImpl);
    const maya = phone('maya', createEmptyState([...TRAVELERS]), fetchImpl);
    await ofek.sync();
    await maya.sync();
    ofek.edit(withItems('maya', [{ ...item('m1', 'Goggles'), packed: true }], ofek.state));
    maya.edit(withItems('maya', [{ ...item('m1', 'Ski goggles') }], maya.state));
    await ofek.sync();
    await maya.sync();
    await ofek.sync();
    expect(ofek.state.lists.maya[0]!.name).toBe('Ski goggles');
    expect(maya.state.lists.maya).toEqual(ofek.state.lists.maya);
  });

  it('reports a wrong code, a missing setup and being offline', async () => {
    const { fetchImpl } = server();
    expect(
      (await phone('ofek', createEmptyState([...TRAVELERS]), fetchImpl, 'nope').sync()).status,
    ).toBe('wrong-code');
    const notSetUp = (async () => new Response('{}', { status: 501 })) as unknown as typeof fetch;
    expect((await phone('ofek', createEmptyState([...TRAVELERS]), notSetUp).sync()).status).toBe(
      'not-set-up',
    );
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect((await phone('ofek', createEmptyState([...TRAVELERS]), offline).sync()).status).toBe(
      'offline',
    );
  });
});
