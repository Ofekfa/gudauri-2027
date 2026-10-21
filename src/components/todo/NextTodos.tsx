import { useMemo } from 'preact/hooks';
import { href } from '../../lib/router/hashRouter';
import { appStore } from '../../lib/storage/safeStorage';
import { formatDue, TODO_TIME_ZONE } from '../../lib/todo/due';
import { SHARED_LIST, TODO_LIST_IDS, type TodoItem, type TodoListId } from '../../lib/todo/model';
import { loadTodoStateSync } from '../../lib/todo/repository';
import { dueStatus, dueStatusLabel, nextDue } from '../../lib/todo/selectors';
import { Icon } from '../Icon';
import { listLabel, TODO_PROFILE_KEY } from './profiles';

const SHOWN = 3;

type Entry = TodoItem & { list: TodoListId };

/** Home card: the nearest pre-flight deadlines for the last-selected person plus shared tasks. */
export function NextTodos() {
  const stored = appStore.get(TODO_PROFILE_KEY);
  const person =
    TODO_LIST_IDS.find((id) => id === stored && id !== SHARED_LIST) ?? TODO_LIST_IDS[0]!;
  // Read synchronously so the card is there on first paint (no layout shift).
  const entries = useMemo(() => {
    const state = loadTodoStateSync();
    const pool: Entry[] = [
      ...state.lists[person].map((i) => ({ ...i, list: person })),
      ...state.lists[SHARED_LIST].map((i) => ({ ...i, list: SHARED_LIST })),
    ];
    return nextDue(pool, SHOWN) as Entry[];
  }, [person]);
  const now = Date.now();

  return (
    <section class="card next-todos" aria-labelledby="next-todos-title">
      <h2 id="next-todos-title" class="next-todos__title">
        <Icon name="checklist" size={20} /> Next to-dos
      </h2>
      {entries.length === 0 ? (
        <p class="next-todos__empty">
          Insurance, eSIM, online check-in…{' '}
          <a href={href('/todo')}>Start the pre-flight checklist</a>.
        </p>
      ) : (
        <>
          <ul class="next-todos__list">
            {entries.map((e) => {
              const status = dueStatus(e.dueBy!, now, TODO_TIME_ZONE);
              return (
                <li key={`${e.list}-${e.id}`}>
                  <span class="next-todos__item">{e.title}</span>
                  <span class="next-todos__meta">
                    {listLabel(e.list)} · {formatDue(e.dueBy!)}{' '}
                    <span
                      class={`todo-due${status.kind === 'overdue' || status.kind === 'today' ? ' todo-due--urgent' : ''}`}
                    >
                      {dueStatusLabel(status)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <a class="next-todos__more" href={href('/todo')}>
            Open {listLabel(person)}’s to-do list →
          </a>
        </>
      )}
    </section>
  );
}
