import type { TravelerId } from '../../data/trip';
import {
  MAX_ITEMS_PER_LIST,
  normalizeName,
  type Category,
  type Ownership,
  type PackingItem,
  type PackingState,
} from './model';

export interface NewItem {
  name: string;
  category: Category;
  ownership: Ownership;
}

export type PackingAction =
  | { type: 'add'; traveler: TravelerId; item: NewItem; id: string; now: number }
  | { type: 'rename'; traveler: TravelerId; id: string; name: string }
  | { type: 'setCategory'; traveler: TravelerId; id: string; category: Category }
  | { type: 'toggleOwnership'; traveler: TravelerId; id: string }
  | { type: 'togglePacked'; traveler: TravelerId; id: string }
  | { type: 'remove'; traveler: TravelerId; id: string }
  /** Undo a removal: put the item back where it was. */
  | { type: 'restore'; traveler: TravelerId; item: PackingItem; index: number }
  | { type: 'applyTemplate'; traveler: TravelerId; items: NewItem[]; ids: string[]; now: number }
  | { type: 'skipTemplate'; traveler: TravelerId }
  | { type: 'replaceAll'; state: PackingState };

function updateList(
  state: PackingState,
  traveler: TravelerId,
  update: (items: PackingItem[]) => PackingItem[],
): PackingState {
  const current = state.lists[traveler] ?? [];
  const next = update(current);
  return next === current ? state : { ...state, lists: { ...state.lists, [traveler]: next } };
}

function updateItem(
  state: PackingState,
  traveler: TravelerId,
  id: string,
  patch: (item: PackingItem) => PackingItem,
): PackingState {
  return updateList(state, traveler, (items) =>
    items.some((i) => i.id === id) ? items.map((i) => (i.id === id ? patch(i) : i)) : items,
  );
}

const isNew = (items: PackingItem[], name: string) =>
  !items.some((i) => i.name.toLocaleLowerCase() === name.toLocaleLowerCase());

export function packingReducer(state: PackingState, action: PackingAction): PackingState {
  switch (action.type) {
    case 'add': {
      const name = normalizeName(action.item.name);
      if (!name) return state;
      return updateList(state, action.traveler, (items) =>
        items.length >= MAX_ITEMS_PER_LIST
          ? items
          : [
              ...items,
              { ...action.item, name, id: action.id, packed: false, createdAt: action.now },
            ],
      );
    }
    case 'rename': {
      const name = normalizeName(action.name);
      if (!name) return state;
      return updateItem(state, action.traveler, action.id, (i) => ({ ...i, name }));
    }
    case 'setCategory':
      return updateItem(state, action.traveler, action.id, (i) => ({
        ...i,
        category: action.category,
      }));
    case 'toggleOwnership':
      return updateItem(state, action.traveler, action.id, (i) => ({
        ...i,
        ownership: i.ownership === 'have' ? 'need-to-buy' : 'have',
      }));
    case 'togglePacked':
      return updateItem(state, action.traveler, action.id, (i) => ({ ...i, packed: !i.packed }));
    case 'remove':
      return updateList(state, action.traveler, (items) =>
        items.some((i) => i.id === action.id) ? items.filter((i) => i.id !== action.id) : items,
      );
    case 'restore':
      return updateList(state, action.traveler, (items) => {
        if (items.some((i) => i.id === action.item.id)) return items;
        const next = [...items];
        next.splice(Math.min(action.index, next.length), 0, action.item);
        return next;
      });
    case 'applyTemplate': {
      const withTemplate = updateList(state, action.traveler, (items) => {
        const added: PackingItem[] = [];
        action.items.forEach((item, index) => {
          const name = normalizeName(item.name);
          if (name && isNew([...items, ...added], name)) {
            added.push({
              ...item,
              name,
              id: action.ids[index]!,
              packed: false,
              createdAt: action.now,
            });
          }
        });
        return [...items, ...added].slice(0, MAX_ITEMS_PER_LIST);
      });
      return {
        ...withTemplate,
        templateDecided: { ...withTemplate.templateDecided, [action.traveler]: true },
      };
    }
    case 'skipTemplate':
      return {
        ...state,
        templateDecided: { ...state.templateDecided, [action.traveler]: true },
      };
    case 'replaceAll':
      return action.state;
  }
}
