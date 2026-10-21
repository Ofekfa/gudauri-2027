import { useMemo, useRef, useState } from 'preact/hooks';
import { AddItemForm } from '../components/packing/AddItemForm';
import { BackupPanel } from '../components/packing/BackupPanel';
import { FilterBar } from '../components/packing/FilterBar';
import { PackingItemRow } from '../components/packing/PackingItemRow';
import { ProfileSwitcher } from '../components/packing/ProfileSwitcher';
import { TemplateOffer } from '../components/packing/TemplateOffer';
import { PageHeader } from '../components/PageHeader';
import { PACKING_TEMPLATE } from '../data/packingTemplate';
import { trip, type TravelerId } from '../data/trip';
import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  defaultIdGenerator,
  type Category,
  type PackingItem,
} from '../lib/packing/model';
import { filterItems, groupByCategory, progress, type Filters } from '../lib/packing/selectors';
import { usePacking } from '../lib/packing/usePacking';
import { appStore } from '../lib/storage/safeStorage';
import { toasts } from '../lib/toast/toastStore';

const PROFILE_KEY = 'packing:profile';
const UNDO_TOAST_MS = 6_000;
const ALL_FILTERS: Filters = { category: 'all', status: 'all' };
const DEFAULT_CATEGORY: Category = 'clothing';

function initialProfile(): TravelerId {
  const stored = appStore.get(PROFILE_KEY);
  return trip.travelers.find((t) => t.id === stored)?.id ?? trip.travelers[0]!.id;
}

export default function PackingPage() {
  const { state, dispatch, loaded } = usePacking();
  const [traveler, setTraveler] = useState<TravelerId>(initialProfile);
  const [filters, setFilters] = useState<Filters>(ALL_FILTERS);
  const addInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const name = trip.travelers.find((t) => t.id === traveler)!.name;
  const items = state.lists[traveler] ?? [];
  const visible = useMemo(() => filterItems(items, filters), [items, filters]);
  const stats = progress(items);
  const summaries = useMemo(() => {
    const result = {} as Record<TravelerId, string>;
    for (const { id } of trip.travelers) {
      const p = progress(state.lists[id] ?? []);
      result[id] = p.total ? `${p.packed}/${p.total}` : '—';
    }
    return result;
  }, [state]);

  const selectTraveler = (id: TravelerId) => {
    setTraveler(id);
    appStore.set(PROFILE_KEY, id);
  };

  const deleteItem = (item: PackingItem) => {
    const index = items.findIndex((i) => i.id === item.id);
    // Keep keyboard focus nearby: the next row's checkbox, else the add field.
    const next = items[index + 1] ?? items[index - 1];
    dispatch({ type: 'remove', traveler, id: item.id });
    requestAnimationFrame(() => {
      const target =
        next && listRef.current?.querySelector<HTMLInputElement>(`#pack-${CSS.escape(next.id)}`);
      (target ?? addInputRef.current)?.focus();
    });
    const owner = traveler;
    toasts.show({
      message: `Deleted “${item.name}”.`,
      durationMs: UNDO_TOAST_MS,
      action: {
        label: 'Undo',
        onSelect: () => dispatch({ type: 'restore', traveler: owner, item, index }),
      },
    });
  };

  const renderRows = (rows: PackingItem[]) => (
    <ul class="pack-list">
      {rows.map((item) => (
        <PackingItemRow
          key={item.id}
          item={item}
          onTogglePacked={() => dispatch({ type: 'togglePacked', traveler, id: item.id })}
          onToggleOwnership={() => dispatch({ type: 'toggleOwnership', traveler, id: item.id })}
          onSave={(newName, category) => {
            dispatch({ type: 'rename', traveler, id: item.id, name: newName });
            dispatch({ type: 'setCategory', traveler, id: item.id, category });
          }}
          onDelete={() => deleteItem(item)}
        />
      ))}
    </ul>
  );

  const filtersActive = filters.category !== 'all' || filters.status !== 'all';
  const percent = stats.total ? Math.round((stats.packed / stats.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Packing lists"
        subtitle="Everyone has their own list. Tick things off as you pack."
      />
      <ProfileSwitcher selected={traveler} onSelect={selectTraveler} summaries={summaries} />

      {/* Everything below depends on the saved lists; render it in one go to avoid layout shift. */}
      {!loaded ? (
        <p class="page-loading" role="status">
          Loading…
        </p>
      ) : (
        <>
          <section class="pack-summary" aria-labelledby="pack-summary-title">
            <h2 id="pack-summary-title">{name}’s list</h2>
            <p class="pack-summary__numbers">
              <strong>
                {stats.packed}/{stats.total}
              </strong>{' '}
              packed
              {stats.needToBuy > 0 && (
                <span class="pack-summary__buy">{stats.needToBuy} to buy</span>
              )}
            </p>
            <progress
              class="pack-progress"
              max={100}
              value={percent}
              aria-label={`${name}: ${stats.packed} of ${stats.total} items packed`}
            />
          </section>

          {!state.templateDecided[traveler] && (
            <TemplateOffer
              name={name}
              itemCount={PACKING_TEMPLATE.length}
              onAccept={() =>
                dispatch({
                  type: 'applyTemplate',
                  traveler,
                  items: PACKING_TEMPLATE,
                  ids: PACKING_TEMPLATE.map(() => defaultIdGenerator()),
                  now: Date.now(),
                })
              }
              onSkip={() => dispatch({ type: 'skipTemplate', traveler })}
            />
          )}

          <AddItemForm
            key={traveler}
            inputRef={addInputRef}
            defaultCategory={filters.category === 'all' ? DEFAULT_CATEGORY : filters.category}
            onAdd={(item) =>
              dispatch({ type: 'add', traveler, item, id: defaultIdGenerator(), now: Date.now() })
            }
          />

          {items.length > 0 && <FilterBar filters={filters} onChange={setFilters} />}

          <div ref={listRef} class="pack-lists">
            {items.length === 0 ? (
              <p class="empty-note">Nothing here yet. Add the first item above.</p>
            ) : visible.length === 0 ? (
              <p class="empty-note">
                No items match these filters.{' '}
                <button type="button" class="link-button" onClick={() => setFilters(ALL_FILTERS)}>
                  Show everything
                </button>
              </p>
            ) : filters.category === 'all' ? (
              groupByCategory(visible).map((group) => {
                const all = items.filter((i) => i.category === group.category);
                return (
                  <section
                    key={group.category}
                    class="pack-group"
                    aria-labelledby={`group-${group.category}`}
                  >
                    <h3 id={`group-${group.category}`}>
                      <span aria-hidden="true">{CATEGORY_EMOJI[group.category]}</span>{' '}
                      {CATEGORY_LABEL[group.category]}
                      <span class="pack-group__count">
                        {all.filter((i) => i.packed).length}/{all.length}
                      </span>
                    </h3>
                    {renderRows(group.items)}
                  </section>
                );
              })
            ) : (
              renderRows(visible)
            )}
            {filtersActive && visible.length > 0 && (
              <p class="empty-note">
                Showing {visible.length} of {items.length}.{' '}
                <button type="button" class="link-button" onClick={() => setFilters(ALL_FILTERS)}>
                  Clear filters
                </button>
              </p>
            )}
          </div>

          <BackupPanel
            state={state}
            onImport={(imported) => dispatch({ type: 'replaceAll', state: imported })}
          />
        </>
      )}
    </>
  );
}
