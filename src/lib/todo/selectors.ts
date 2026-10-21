import { localDateIn, daysBetween } from '../time/countdown';
import type { TodoCategory, TodoItem } from './model';

export type TodoCategoryFilter = TodoCategory | 'all';
export const TODO_STATUS_FILTERS = ['all', 'open', 'done'] as const;
export type TodoStatusFilter = (typeof TODO_STATUS_FILTERS)[number];
export const TODO_STATUS_LABEL: Record<TodoStatusFilter, string> = {
  all: 'All',
  open: 'To do',
  done: 'Done',
};

export interface TodoFilters {
  category: TodoCategoryFilter;
  status: TodoStatusFilter;
}

export function filterTodos(items: TodoItem[], { category, status }: TodoFilters): TodoItem[] {
  return items.filter(
    (i) =>
      (category === 'all' || i.category === category) &&
      (status === 'all' || (status === 'done' ? i.done : !i.done)),
  );
}

const dueMs = (i: TodoItem) => (i.dueBy ? Date.parse(i.dueBy) : Number.POSITIVE_INFINITY);

/** Open items first (earliest deadline first, undated last), then done items. */
export function sortTodos(items: TodoItem[]): TodoItem[] {
  return [...items].sort(
    (a, b) => Number(a.done) - Number(b.done) || dueMs(a) - dueMs(b) || a.createdAt - b.createdAt,
  );
}

export function todoProgress(items: TodoItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/** The `count` open items with the nearest deadlines (undated items are skipped). */
export function nextDue(items: TodoItem[], count: number): TodoItem[] {
  return sortTodos(items.filter((i) => !i.done && i.dueBy)).slice(0, count);
}

export type DueStatus =
  { kind: 'overdue' } | { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'later'; days: number };

/** Relative deadline in calendar days of `timeZone` (Israel time for this trip). */
export function dueStatus(dueBy: string, nowMs: number, timeZone: string): DueStatus {
  const due = Date.parse(dueBy);
  if (due < nowMs) return { kind: 'overdue' };
  const days = daysBetween(localDateIn(nowMs, timeZone), localDateIn(due, timeZone));
  if (days <= 0) return { kind: 'today' };
  if (days === 1) return { kind: 'tomorrow' };
  return { kind: 'later', days };
}

export function dueStatusLabel(status: DueStatus): string {
  switch (status.kind) {
    case 'overdue':
      return 'Overdue';
    case 'today':
      return 'Due today';
    case 'tomorrow':
      return 'Due tomorrow';
    case 'later':
      return `In ${status.days} days`;
  }
}
