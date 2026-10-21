import {
  MAX_TODOS_PER_LIST,
  normalizeNote,
  normalizeTitle,
  type TodoCategory,
  type TodoItem,
  type TodoListId,
  type TodoState,
} from './model';

export interface NewTodo {
  title: string;
  category: TodoCategory;
  note?: string;
  dueBy?: string;
  templateKey?: string;
}

export interface TodoPatch {
  title?: string;
  category?: TodoCategory;
  /** Empty string clears the note. */
  note?: string;
  /** null clears the due date. */
  dueBy?: string | null;
}

export type TodoAction =
  | { type: 'add'; list: TodoListId; item: NewTodo; id: string; now: number }
  | { type: 'edit'; list: TodoListId; id: string; patch: TodoPatch }
  | { type: 'toggleDone'; list: TodoListId; id: string }
  | { type: 'remove'; list: TodoListId; id: string }
  | { type: 'restore'; list: TodoListId; item: TodoItem; index: number }
  | { type: 'applyTemplate'; list: TodoListId; items: NewTodo[]; ids: string[]; now: number }
  | { type: 'skipTemplate'; list: TodoListId }
  | { type: 'replaceAll'; state: TodoState };

function updateList(
  state: TodoState,
  list: TodoListId,
  update: (items: TodoItem[]) => TodoItem[],
): TodoState {
  const current = state.lists[list] ?? [];
  const next = update(current);
  return next === current ? state : { ...state, lists: { ...state.lists, [list]: next } };
}

function build(item: NewTodo, id: string, now: number): TodoItem | null {
  const title = normalizeTitle(item.title);
  if (!title) return null;
  const note = item.note ? normalizeNote(item.note) : '';
  return {
    id,
    title,
    category: item.category,
    done: false,
    createdAt: now,
    ...(note ? { note } : {}),
    ...(item.dueBy ? { dueBy: item.dueBy } : {}),
    ...(item.templateKey ? { templateKey: item.templateKey } : {}),
  };
}

function applyPatch(item: TodoItem, patch: TodoPatch): TodoItem {
  const next: TodoItem = { ...item };
  if (patch.title !== undefined) {
    const title = normalizeTitle(patch.title);
    if (title) next.title = title;
  }
  if (patch.category) next.category = patch.category;
  if (patch.note !== undefined) {
    const note = normalizeNote(patch.note);
    if (note) next.note = note;
    else delete next.note;
  }
  if (patch.dueBy !== undefined) {
    if (patch.dueBy) next.dueBy = patch.dueBy;
    else delete next.dueBy;
  }
  return next;
}

const sameTitle = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'add': {
      const item = build(action.item, action.id, action.now);
      if (!item) return state;
      return updateList(state, action.list, (items) =>
        items.length >= MAX_TODOS_PER_LIST ? items : [...items, item],
      );
    }
    case 'edit':
      return updateList(state, action.list, (items) =>
        items.some((i) => i.id === action.id)
          ? items.map((i) => (i.id === action.id ? applyPatch(i, action.patch) : i))
          : items,
      );
    case 'toggleDone':
      return updateList(state, action.list, (items) =>
        items.some((i) => i.id === action.id)
          ? items.map((i) => (i.id === action.id ? { ...i, done: !i.done } : i))
          : items,
      );
    case 'remove':
      return updateList(state, action.list, (items) =>
        items.some((i) => i.id === action.id) ? items.filter((i) => i.id !== action.id) : items,
      );
    case 'restore':
      return updateList(state, action.list, (items) => {
        if (items.some((i) => i.id === action.item.id)) return items;
        const next = [...items];
        next.splice(Math.min(action.index, next.length), 0, action.item);
        return next;
      });
    case 'applyTemplate': {
      const withTemplate = updateList(state, action.list, (items) => {
        const added: TodoItem[] = [];
        action.items.forEach((template, index) => {
          const item = build(template, action.ids[index]!, action.now);
          if (item && ![...items, ...added].some((i) => sameTitle(i.title, item.title))) {
            added.push(item);
          }
        });
        return [...items, ...added].slice(0, MAX_TODOS_PER_LIST);
      });
      return {
        ...withTemplate,
        templateDecided: { ...withTemplate.templateDecided, [action.list]: true },
      };
    }
    case 'skipTemplate':
      return { ...state, templateDecided: { ...state.templateDecided, [action.list]: true } };
    case 'replaceAll':
      return action.state;
  }
}
