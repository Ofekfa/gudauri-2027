import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BackupPanel } from '../components/common/BackupPanel';
import { SyncPanel } from '../components/common/SyncPanel';
import { itemKey, todoAdapter } from '../lib/sync/adapters';
import { useListSync } from '../lib/sync/useListSync';
import { ProfileSwitcher } from '../components/common/ProfileSwitcher';
import { ProgressSummary } from '../components/common/ProgressSummary';
import { TemplateOffer } from '../components/common/TemplateOffer';
import { PageHeader } from '../components/PageHeader';
import { listLabel, TODO_PROFILE_KEY, TODO_PROFILES } from '../components/todo/profiles';
import { TodoAddForm } from '../components/todo/TodoAddForm';
import { TodoRow } from '../components/todo/TodoRow';
import { MISSING_GEAR_KEY, personalTemplate, sharedTemplate } from '../data/todoTemplate';
import { trip, type TravelerId } from '../data/trip';
import { progress as packingProgress } from '../lib/packing/selectors';
import { defaultPackingRepository } from '../lib/packing/usePacking';
import { href } from '../lib/router/hashRouter';
import { appStore } from '../lib/storage/safeStorage';
import { toasts } from '../lib/toast/toastStore';
import { TODO_TIME_ZONE } from '../lib/todo/due';
import { parseTodoImport, serializeTodoExport } from '../lib/todo/importExport';
import {
  defaultIdGenerator,
  SHARED_LIST,
  TODO_CATEGORIES,
  TODO_CATEGORY_EMOJI,
  TODO_CATEGORY_LABEL,
  TODO_LIST_IDS,
  type TodoItem,
  type TodoListId,
} from '../lib/todo/model';
import {
  dueStatus,
  filterTodos,
  sortTodos,
  todoProgress,
  TODO_STATUS_FILTERS,
  TODO_STATUS_LABEL,
  type TodoFilters,
} from '../lib/todo/selectors';
import { useTodo } from '../lib/todo/useTodo';

const UNDO_TOAST_MS = 6_000;
const ALL_FILTERS: TodoFilters = { category: 'all', status: 'all' };

function initialList(): TodoListId {
  const stored = appStore.get(TODO_PROFILE_KEY);
  return TODO_LIST_IDS.find((id) => id === stored) ?? TODO_LIST_IDS[0]!;
}

/** "Need to buy" counts per traveler, from the packing lists on this device. */
function useNeedToBuyCounts(): Partial<Record<TravelerId, number>> {
  const [counts, setCounts] = useState<Partial<Record<TravelerId, number>>>({});
  useEffect(() => {
    void defaultPackingRepository.load().then((state) => {
      const result: Partial<Record<TravelerId, number>> = {};
      for (const { id } of trip.travelers)
        result[id] = packingProgress(state.lists[id] ?? []).needToBuy;
      setCounts(result);
    });
  }, []);
  return counts;
}

export default function TodoPage() {
  const { state, dispatch, loaded } = useTodo();
  const sync = useListSync(
    todoAdapter,
    state,
    (next) => dispatch({ type: 'replaceAll', state: next }),
    loaded,
  );
  /** Who else changed an item last (nobody, or this phone's owner: no tag). */
  const changedBy = (id: string) => {
    const by = sync.changedBy[itemKey(list, id)];
    return by && by !== sync.settings.me ? by : null;
  };
  const [list, setList] = useState<TodoListId>(initialList);
  const [filters, setFilters] = useState<TodoFilters>(ALL_FILTERS);
  const addInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const needToBuy = useNeedToBuyCounts();
  const now = Date.now();

  const items = state.lists[list] ?? [];
  const visible = useMemo(() => sortTodos(filterTodos(items, filters)), [items, filters]);
  const stats = todoProgress(items);
  const overdue = items.filter(
    (i) => !i.done && i.dueBy && dueStatus(i.dueBy, now, TODO_TIME_ZONE).kind === 'overdue',
  ).length;
  const label = listLabel(list);
  const isShared = list === SHARED_LIST;
  const template = isShared ? sharedTemplate(trip) : personalTemplate(trip);
  const summaries = useMemo(() => {
    const result: Partial<Record<TodoListId, string>> = {};
    for (const id of TODO_LIST_IDS) {
      const p = todoProgress(state.lists[id] ?? []);
      result[id] = p.total ? `${p.done}/${p.total}` : '—';
    }
    return result;
  }, [state]);

  const selectList = (id: TodoListId) => {
    setList(id);
    appStore.set(TODO_PROFILE_KEY, id);
  };

  const deleteItem = (item: TodoItem) => {
    const index = items.findIndex((i) => i.id === item.id);
    const sorted = visible;
    const pos = sorted.findIndex((i) => i.id === item.id);
    const next = sorted[pos + 1] ?? sorted[pos - 1];
    dispatch({ type: 'remove', list, id: item.id });
    requestAnimationFrame(() => {
      const target =
        next && listRef.current?.querySelector<HTMLInputElement>(`#todo-${CSS.escape(next.id)}`);
      (target ?? addInputRef.current)?.focus();
    });
    const owner = list;
    toasts.show({
      message: `Deleted “${item.title}”.`,
      durationMs: UNDO_TOAST_MS,
      action: {
        label: 'Undo',
        onSelect: () => dispatch({ type: 'restore', list: owner, item, index }),
      },
    });
  };

  const missingGear = (item: TodoItem) => {
    if (item.templateKey !== MISSING_GEAR_KEY || isShared) return undefined;
    const count = needToBuy[list as TravelerId];
    if (count === undefined) return undefined;
    return (
      <p class="todo-item__link">
        {count === 0 ? (
          'Nothing is marked “need to buy” on your packing list yet.'
        ) : (
          <a href={href('/packing', { who: list, status: 'need-to-buy' })}>
            {count} packing item{count === 1 ? '' : 's'} marked “need to buy” →
          </a>
        )}
      </p>
    );
  };

  return (
    <>
      <PageHeader
        title="To-do"
        subtitle="Everything to sort out before we fly. Dates are in Israel time."
      />
      <SyncPanel view={sync} what={'to-do lists'} />
      <ProfileSwitcher
        profiles={TODO_PROFILES}
        selected={list}
        onSelect={selectList}
        summaries={summaries}
        ariaLabel="Whose to-do list"
      />

      {!loaded ? (
        <p class="page-loading" role="status">
          Loading…
        </p>
      ) : (
        <>
          <ProgressSummary
            id="todo-summary-title"
            title={isShared ? 'Shared to-dos' : `${label}’s to-dos`}
            done={stats.done}
            total={stats.total}
            doneLabel="done"
            badge={overdue > 0 ? `${overdue} overdue` : undefined}
            ariaLabel={`${label}: ${stats.done} of ${stats.total} to-dos done`}
          />

          {!state.templateDecided[list] && (
            <TemplateOffer
              emoji={isShared ? '🤝' : '🗓️'}
              heading={
                isShared ? 'Start the shared checklist?' : `Start with a checklist, ${label}?`
              }
              description={
                isShared
                  ? `Add ${template.length} group tasks (airport transfer, ski rental and instructors). Whoever takes one ticks it off here.`
                  : `Add ${template.length} pre-flight tasks (insurance, eSIM, online check-in and more) with deadlines based on our flights.`
              }
              onAccept={() =>
                dispatch({
                  type: 'applyTemplate',
                  list,
                  items: template,
                  ids: template.map(() => defaultIdGenerator()),
                  now: Date.now(),
                })
              }
              onSkip={() => dispatch({ type: 'skipTemplate', list })}
            />
          )}

          <TodoAddForm
            key={list}
            inputRef={addInputRef}
            defaultCategory={filters.category === 'all' ? 'documents' : filters.category}
            onAdd={(item) =>
              dispatch({ type: 'add', list, item, id: defaultIdGenerator(), now: Date.now() })
            }
          />

          {items.length > 0 && (
            <div class="filters">
              <div class="filters__group" role="group" aria-label="Filter by category">
                {(['all', ...TODO_CATEGORIES] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    class="chip-button"
                    aria-pressed={filters.category === c}
                    onClick={() => setFilters({ ...filters, category: c })}
                  >
                    {c === 'all' ? (
                      'All categories'
                    ) : (
                      <>
                        <span aria-hidden="true">{TODO_CATEGORY_EMOJI[c]}</span>{' '}
                        {TODO_CATEGORY_LABEL[c]}
                      </>
                    )}
                  </button>
                ))}
              </div>
              <div class="filters__group" role="group" aria-label="Filter by status">
                {TODO_STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    class="chip-button chip-button--small"
                    aria-pressed={filters.status === s}
                    onClick={() => setFilters({ ...filters, status: s })}
                  >
                    {TODO_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <p class="empty-note">Nothing here yet. Add the first to-do above.</p>
          ) : visible.length === 0 ? (
            <p class="empty-note">
              No to-dos match these filters.{' '}
              <button type="button" class="link-button" onClick={() => setFilters(ALL_FILTERS)}>
                Show everything
              </button>
            </p>
          ) : (
            <ul class="pack-list" ref={listRef}>
              {visible.map((item) => (
                <TodoRow
                  changedBy={changedBy(item.id)}
                  key={item.id}
                  item={item}
                  now={now}
                  onToggle={() => dispatch({ type: 'toggleDone', list, id: item.id })}
                  onSave={(patch) => dispatch({ type: 'edit', list, id: item.id, patch })}
                  onDelete={() => deleteItem(item)}
                  extra={missingGear(item)}
                />
              ))}
            </ul>
          )}

          <BackupPanel
            fileStem="gudauri-todo"
            scope="all five to-do lists"
            fileKind="a to-do list"
            serialize={(when) => serializeTodoExport(state, when)}
            parse={parseTodoImport}
            onImport={(imported) => dispatch({ type: 'replaceAll', state: imported })}
          />
        </>
      )}
    </>
  );
}
