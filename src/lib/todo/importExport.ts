import type { ParseResult } from '../list/backup';
import {
  createEmptyTodoState,
  MAX_TODOS_PER_LIST,
  normalizeNote,
  normalizeTitle,
  TODO_CATEGORIES,
  TODO_LIST_IDS,
  TODO_STATE_VERSION,
  type TodoItem,
  type TodoListId,
  type TodoState,
} from './model';

export const TODO_EXPORT_APP_ID = 'gudauri-2027/todo';

export function serializeTodoExport(state: TodoState, now: Date): string {
  return JSON.stringify(
    { app: TODO_EXPORT_APP_ID, exportedAt: now.toISOString(), data: state },
    null,
    2,
  );
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function parseItem(raw: unknown): TodoItem | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.title !== 'string') {
    return null;
  }
  const title = normalizeTitle(raw.title);
  if (!title || !TODO_CATEGORIES.includes(raw.category as TodoItem['category'])) return null;
  const note = typeof raw.note === 'string' ? normalizeNote(raw.note) : '';
  const dueBy =
    typeof raw.dueBy === 'string' && !Number.isNaN(Date.parse(raw.dueBy)) ? raw.dueBy : undefined;
  return {
    id: raw.id,
    title,
    category: raw.category as TodoItem['category'],
    done: raw.done === true,
    createdAt:
      typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
    ...(note ? { note } : {}),
    ...(dueBy ? { dueBy } : {}),
    ...(typeof raw.templateKey === 'string' ? { templateKey: raw.templateKey } : {}),
  };
}

/** Validates untrusted state (stored or imported): invalid items skipped, unknown lists dropped. */
export function validateTodoState(
  raw: unknown,
  listIds: readonly TodoListId[] = TODO_LIST_IDS,
): TodoState | null {
  if (!isRecord(raw) || raw.version !== TODO_STATE_VERSION || !isRecord(raw.lists)) return null;
  const state = createEmptyTodoState(listIds);
  const decided = isRecord(raw.templateDecided) ? raw.templateDecided : {};
  for (const id of listIds) {
    const items = raw.lists[id];
    if (Array.isArray(items)) {
      const seen = new Set<string>();
      state.lists[id] = items
        .map(parseItem)
        .filter((i): i is TodoItem => i !== null && !seen.has(i.id) && Boolean(seen.add(i.id)))
        .slice(0, MAX_TODOS_PER_LIST);
    }
    state.templateDecided[id] = decided[id] === true || state.lists[id].length > 0;
  }
  return state;
}

export function parseTodoImport(text: string): ParseResult<TodoState> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' };
  }
  if (!isRecord(json) || json.app !== TODO_EXPORT_APP_ID) {
    return { ok: false, error: 'This file wasn’t exported from the Gudauri 2027 to-do list.' };
  }
  const state = validateTodoState(json.data);
  return state
    ? { ok: true, value: state }
    : { ok: false, error: 'This to-do file is from a different version of the site.' };
}
