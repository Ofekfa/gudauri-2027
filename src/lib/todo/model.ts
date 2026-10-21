import { trip, type TravelerId } from '../../data/trip';
import { normalizeText } from '../list/text';

export { defaultIdGenerator, type IdGenerator } from '../list/ids';

/** Each traveler has a list, plus one for group tasks. */
export type TodoListId = TravelerId | 'shared';
export const SHARED_LIST: TodoListId = 'shared';
export const TODO_LIST_IDS: TodoListId[] = [...trip.travelers.map((t) => t.id), SHARED_LIST];

export const TODO_CATEGORIES = ['documents', 'connectivity', 'flight', 'gear', 'ski'] as const;
export type TodoCategory = (typeof TODO_CATEGORIES)[number];

export const TODO_CATEGORY_LABEL: Record<TodoCategory, string> = {
  documents: 'Documents & insurance',
  connectivity: 'Connectivity',
  flight: 'Flight',
  gear: 'Gear',
  ski: 'Ski',
};

export const TODO_CATEGORY_EMOJI: Record<TodoCategory, string> = {
  documents: '📄',
  connectivity: '📶',
  flight: '✈️',
  gear: '🧤',
  ski: '⛷️',
};

export interface TodoItem {
  id: string;
  title: string;
  note?: string;
  done: boolean;
  /** Absolute deadline (ISO 8601). Shown in Israel time. */
  dueBy?: string;
  category: TodoCategory;
  /** Set on starter-template items that get special UI (e.g. the packing link). */
  templateKey?: string;
  createdAt: number;
}

export const TODO_STATE_VERSION = 1;

export interface TodoState {
  version: typeof TODO_STATE_VERSION;
  lists: Record<TodoListId, TodoItem[]>;
  templateDecided: Record<TodoListId, boolean>;
}

export const MAX_TITLE_LENGTH = 100;
export const MAX_NOTE_LENGTH = 300;
export const MAX_TODOS_PER_LIST = 200;

export const normalizeTitle = (title: string) => normalizeText(title, MAX_TITLE_LENGTH);
export const normalizeNote = (note: string) => normalizeText(note, MAX_NOTE_LENGTH);

export function createEmptyTodoState(listIds: readonly TodoListId[] = TODO_LIST_IDS): TodoState {
  const lists = {} as Record<TodoListId, TodoItem[]>;
  const templateDecided = {} as Record<TodoListId, boolean>;
  for (const id of listIds) {
    lists[id] = [];
    templateDecided[id] = false;
  }
  return { version: TODO_STATE_VERSION, lists, templateDecided };
}
