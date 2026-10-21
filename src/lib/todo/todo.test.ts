import { describe, expect, it } from 'vitest';
import { MISSING_GEAR_KEY, personalTemplate, sharedTemplate } from '../../data/todoTemplate';
import { trip } from '../../data/trip';
import { createMemoryStore } from '../storage/safeStorage';
import { parseTodoImport, serializeTodoExport, validateTodoState } from './importExport';
import { createEmptyTodoState, MAX_TITLE_LENGTH, type TodoState } from './model';
import { createLocalTodoRepository, TODO_STORAGE_KEY } from './repository';
import { todoReducer, type TodoAction } from './reducer';
import {
  dueStatus,
  dueStatusLabel,
  filterTodos,
  nextDue,
  sortTodos,
  todoProgress,
} from './selectors';

const NOW = Date.parse('2027-02-01T10:00:00Z');
const run = (actions: TodoAction[], start: TodoState = createEmptyTodoState()) =>
  actions.reduce(todoReducer, start);
const add = (id: string, title: string, dueBy?: string): TodoAction => ({
  type: 'add',
  list: 'maya',
  id,
  now: NOW,
  item: { title, category: 'documents', ...(dueBy ? { dueBy } : {}) },
});

describe('todoReducer', () => {
  it('adds trimmed items to one list, including the shared list', () => {
    const s = run([
      add('1', '  Buy   insurance '),
      {
        type: 'add',
        list: 'shared',
        id: '2',
        now: NOW,
        item: { title: 'Transfer', category: 'flight' },
      },
    ]);
    expect(s.lists.maya[0]).toMatchObject({ title: 'Buy insurance', done: false });
    expect(s.lists.shared.map((i) => i.title)).toEqual(['Transfer']);
    expect(s.lists.ofek).toEqual([]);
  });

  it('ignores blank titles and caps long ones', () => {
    const s = run([add('1', '  '), add('2', 'x'.repeat(500))]);
    expect(s.lists.maya).toHaveLength(1);
    expect(s.lists.maya[0]!.title).toHaveLength(MAX_TITLE_LENGTH);
  });

  it('edits fields, clears note and due date, and toggles done', () => {
    const s = run([
      add('1', 'Insurance', '2027-02-10T21:59:00.000Z'),
      {
        type: 'edit',
        list: 'maya',
        id: '1',
        patch: { title: 'Ski insurance', note: 'With rescue', category: 'ski' },
      },
      { type: 'toggleDone', list: 'maya', id: '1' },
    ]);
    expect(s.lists.maya[0]).toMatchObject({
      title: 'Ski insurance',
      note: 'With rescue',
      category: 'ski',
      done: true,
    });
    const cleared = todoReducer(s, {
      type: 'edit',
      list: 'maya',
      id: '1',
      patch: { note: '', dueBy: null },
    });
    expect(cleared.lists.maya[0]!.note).toBeUndefined();
    expect(cleared.lists.maya[0]!.dueBy).toBeUndefined();
  });

  it('removes and restores at the original index', () => {
    const base = run([add('1', 'A'), add('2', 'B'), add('3', 'C')]);
    const removed = todoReducer(base, { type: 'remove', list: 'maya', id: '2' });
    const restored = todoReducer(removed, {
      type: 'restore',
      list: 'maya',
      item: base.lists.maya[1]!,
      index: 1,
    });
    expect(restored.lists.maya.map((i) => i.title)).toEqual(['A', 'B', 'C']);
  });

  it('applies the template once, skipping duplicates', () => {
    const items = personalTemplate(trip);
    const s = run([
      add('x', items[0]!.title.toUpperCase()),
      { type: 'applyTemplate', list: 'maya', items, ids: items.map((_, i) => `t${i}`), now: NOW },
    ]);
    expect(s.lists.maya).toHaveLength(items.length);
    expect(s.templateDecided.maya).toBe(true);
    expect(s.templateDecided.shared).toBe(false);
  });
});

describe('starter templates', () => {
  it('derives deadlines from the flights in trip.ts', () => {
    const personal = personalTemplate(trip);
    const outboundCheckIn = personal.find((i) => i.title.includes(trip.outbound.flightNo))!;
    const returnCheckIn = personal.find((i) => i.title.includes(trip.inbound.flightNo))!;
    // LY5107 departs 05:15 Israel time → check-in due 02:15 Israel (00:15 UTC).
    expect(outboundCheckIn.dueBy).toBe('2027-02-24T00:15:00.000Z');
    // LY5110 departs 23:55 Tbilisi → due 20:55 Tbilisi (16:55 UTC).
    expect(returnCheckIn.dueBy).toBe('2027-02-28T16:55:00.000Z');
    expect(personal.find((i) => i.templateKey === MISSING_GEAR_KEY)).toBeDefined();
  });

  it('puts group tasks on the shared list and dates every starter item', () => {
    const shared = sharedTemplate(trip)
      .map((i) => i.title)
      .join(' | ');
    expect(shared).toMatch(/instructor/i);
    expect(shared).toMatch(/transfer/i);
    expect(shared).toMatch(/rental/i);
    for (const i of [...personalTemplate(trip), ...sharedTemplate(trip)]) {
      expect(Date.parse(i.dueBy!)).toBeLessThan(Date.parse(trip.inbound.departure));
    }
  });
});

describe('selectors', () => {
  const items = run([
    add('late', 'Late', '2027-02-20T10:00:00.000Z'),
    add('none', 'Undated'),
    add('soon', 'Soon', '2027-02-02T10:00:00.000Z'),
    {
      type: 'add',
      list: 'maya',
      id: 'done',
      now: NOW,
      item: { title: 'Done', category: 'gear', dueBy: '2027-01-01T00:00:00Z' },
    },
    { type: 'toggleDone', list: 'maya', id: 'done' },
  ]).lists.maya;

  it('sorts open items by deadline (undated last), done items at the end', () => {
    expect(sortTodos(items).map((i) => i.id)).toEqual(['soon', 'late', 'none', 'done']);
  });

  it('filters by category and status and counts progress', () => {
    expect(filterTodos(items, { category: 'gear', status: 'all' }).map((i) => i.id)).toEqual([
      'done',
    ]);
    expect(filterTodos(items, { category: 'all', status: 'open' })).toHaveLength(3);
    expect(todoProgress(items)).toEqual({ done: 1, total: 4 });
  });

  it('lists the next open deadlines', () => {
    expect(nextDue(items, 2).map((i) => i.id)).toEqual(['soon', 'late']);
  });

  it('describes deadlines in Israel calendar days', () => {
    const tz = 'Asia/Jerusalem';
    expect(dueStatusLabel(dueStatus('2027-02-01T09:00:00Z', NOW, tz))).toBe('Overdue');
    expect(dueStatusLabel(dueStatus('2027-02-01T20:00:00Z', NOW, tz))).toBe('Due today');
    // 22:30 UTC on the 1st is already the 2nd in Israel.
    expect(dueStatusLabel(dueStatus('2027-02-01T22:30:00Z', NOW, tz))).toBe('Due tomorrow');
    expect(dueStatusLabel(dueStatus('2027-02-10T10:00:00Z', NOW, tz))).toBe('In 9 days');
  });
});

describe('persistence', () => {
  it('round-trips through the repository (versioned) and export/import', async () => {
    const store = createMemoryStore();
    const repo = createLocalTodoRepository(store);
    // A list with items has (implicitly) decided about the template, as in packing.
    const state = run([
      add('1', 'Insurance', '2027-02-10T21:59:00.000Z'),
      { type: 'skipTemplate', list: 'maya' },
    ]);
    await repo.save(state);
    expect(await repo.load()).toEqual(state);
    expect(JSON.parse(store.get(TODO_STORAGE_KEY)!).version).toBe(1);
    const parsed = parseTodoImport(serializeTodoExport(state, new Date(NOW)));
    expect(parsed).toEqual({ ok: true, value: state });
  });

  it('rejects foreign files and skips invalid items', () => {
    expect(parseTodoImport('{x')).toMatchObject({ ok: false });
    expect(
      parseTodoImport(JSON.stringify({ app: 'gudauri-2027/packing', data: {} })),
    ).toMatchObject({ ok: false });
    const s = validateTodoState({
      version: 1,
      lists: {
        roy: [
          { id: 'a', title: 'OK', category: 'gear', done: true, createdAt: 1, dueBy: 'not a date' },
          { id: 'b', title: 'Bad', category: 'weapons' },
          { id: 'a', title: 'Dup', category: 'gear' },
        ],
        stranger: [{ id: 'z', title: 'Hi', category: 'gear' }],
      },
    })!;
    expect(s.lists.roy).toEqual([
      { id: 'a', title: 'OK', category: 'gear', done: true, createdAt: 1 },
    ]);
    expect(Object.keys(s.lists)).toEqual(['ofek', 'ron', 'roy', 'maya', 'shared']);
  });
});
