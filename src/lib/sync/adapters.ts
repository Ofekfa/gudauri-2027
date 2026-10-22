/**
 * Packing and to-do state ↔ records. Items become "item/<list>/<id>" (the
 * item as canonical JSON); template choices become "meta/<list>/template".
 * Incoming data is untrusted: it goes through each feature's validator.
 */
import { trip, type TravelerId } from '../../data/trip';
import { validateState } from '../packing/importExport';
import { STATE_VERSION, type PackingItem, type PackingState } from '../packing/model';
import { validateTodoState } from '../todo/importExport';
import {
  TODO_LIST_IDS,
  TODO_STATE_VERSION,
  type TodoItem,
  type TodoListId,
  type TodoState,
} from '../todo/model';
import type { SyncDoc } from './protocol';
import { canonicalJson, SYNCABLE_ID, type Records } from './records';

export interface SyncAdapter<S> {
  doc: SyncDoc;
  toRecords(state: S): Records;
  /** Builds state from records, keeping `previous`'s order and its unsyncable items. */
  fromRecords(records: Records, previous: S): S;
}

export const itemKey = (list: string, id: string) => `item/${list}/${id}`;
const TEMPLATE = 'template';

interface ListState<I extends { id: string; createdAt: number }, L extends string> {
  lists: Record<L, I[]>;
  templateDecided: Record<L, boolean>;
}

function listsToRecords<I extends { id: string; createdAt: number }, L extends string>(
  state: ListState<I, L>,
  listIds: readonly L[],
): Records {
  const records: Records = new Map();
  for (const list of listIds) {
    for (const item of state.lists[list] ?? []) {
      if (SYNCABLE_ID.test(item.id)) records.set(itemKey(list, item.id), canonicalJson(item));
    }
    if (state.templateDecided[list]) records.set(`meta/${list}/${TEMPLATE}`, 'true');
  }
  return records;
}

/** Raw (still unvalidated) lists from records, ordered like `previous`, new items by creation time. */
function recordsToRawLists<I extends { id: string; createdAt: number }, L extends string>(
  records: Records,
  previous: ListState<I, L>,
  listIds: readonly L[],
): { lists: Record<L, unknown[]>; templateDecided: Record<L, boolean> } {
  const lists = {} as Record<L, unknown[]>;
  const templateDecided = {} as Record<L, boolean>;
  for (const list of listIds) {
    const prefix = `item/${list}/`;
    const order = new Map((previous.lists[list] ?? []).map((item, index) => [item.id, index]));
    const items: { raw: unknown; id: string; createdAt: number }[] = [];
    for (const [key, value] of records) {
      if (!key.startsWith(prefix)) continue;
      try {
        const raw = JSON.parse(value) as { id?: unknown; createdAt?: unknown };
        if (raw.id !== key.slice(prefix.length)) continue;
        items.push({ raw, id: raw.id as string, createdAt: Number(raw.createdAt) || 0 });
      } catch {
        /* skip malformed */
      }
    }
    items.sort(
      (a, b) =>
        (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) ||
        a.createdAt - b.createdAt ||
        (a.id < b.id ? -1 : 1),
    );
    // Items we can't sync (odd ids from an old backup) stay on this phone.
    const localOnly = (previous.lists[list] ?? []).filter((item) => !SYNCABLE_ID.test(item.id));
    lists[list] = [...items.map((i) => i.raw), ...localOnly];
    templateDecided[list] = records.get(`meta/${list}/${TEMPLATE}`) === 'true';
  }
  return { lists, templateDecided };
}

const TRAVELER_IDS: TravelerId[] = trip.travelers.map((t) => t.id);

export const packingAdapter: SyncAdapter<PackingState> = {
  doc: 'packing',
  toRecords: (state) => listsToRecords<PackingItem, TravelerId>(state, TRAVELER_IDS),
  fromRecords(records, previous) {
    const raw = {
      version: STATE_VERSION,
      ...recordsToRawLists<PackingItem, TravelerId>(records, previous, TRAVELER_IDS),
    };
    const result = validateState(raw, TRAVELER_IDS);
    return result.ok ? result.state : previous;
  },
};

export const todoAdapter: SyncAdapter<TodoState> = {
  doc: 'todo',
  toRecords: (state) => listsToRecords<TodoItem, TodoListId>(state, TODO_LIST_IDS),
  fromRecords(records, previous) {
    const raw = {
      version: TODO_STATE_VERSION,
      ...recordsToRawLists<TodoItem, TodoListId>(records, previous, TODO_LIST_IDS),
    };
    return validateTodoState(raw) ?? previous;
  },
};
