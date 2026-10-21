import { useMemo, useRef, useState } from 'preact/hooks';
import { AddItemForm } from '../components/packing/AddItemForm';
import { BackupPanel } from '../components/common/BackupPanel';
import { ProgressSummary } from '../components/common/ProgressSummary';
import { ProfileSwitcher, TRAVELER_PROFILES } from '../components/common/ProfileSwitcher';
import { FilterBar } from '../components/packing/FilterBar';
import { OWNERSHIP_HINT_ID, PackingItemRow } from '../components/packing/PackingItemRow';
import { TemplateOffer } from '../components/common/TemplateOffer';
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
import {
  filterItems,
  groupByCategory,
  progress,
  STATUS_FILTERS,
  type Filters,
  type StatusFilter,
} from '../lib/packing/selectors';
import { parseHashQuery } from '../lib/router/hashRouter';
import { usePacking } from '../lib/packing/usePacking';
import { appStore } from '../lib/storage/safeStorage';
import { parseImport, serializeExport } from '../lib/packing/importExport';
import type { ParseResult } from '../lib/list/backup';
import type { PackingState } from '../lib/packing/model';
import { toasts } from '../lib/toast/toastStore';

const PROFILE_KEY = 'packing:profile';
const UNDO_TOAST_MS = 6_000;
const ALL_FILTERS: Filters = { category: 'all', status: 'all' };
const DEFAULT_CATEGORY: Category = 'clothing';

const TRAVELER_IDS = trip.travelers.map((t) => t.id);

function parsePackingBackup(text: string): ParseResult<PackingState> {
  const result = parseImport(text, TRAVELER_IDS);
  return result.ok ? { ok: true, value: result.state } : result;
}

/** `#/packing?who=maya&status=need-to-buy` (used by the to-do list's "missing gear" link). */
function queryParams(): URLSearchParams {
  return parseHashQuery(window.location.hash);
}

function initialFilters(): Filters {
  const status = queryParams().get('status');
  return STATUS_FILTERS.includes(status as StatusFilter)
    ? { ...ALL_FILTERS, status: status as StatusFilter }
    : ALL_FILTERS;
}

function initialProfile(): TravelerId {
  const who = queryParams().get('who');
  const linked = trip.travelers.find((t) => t.id === who)?.id;
  if (linked) return linked;
  const stored = appStore.get(PROFILE_KEY);
  return trip.travelers.find((t) => t.id === stored)?.id ?? trip.travelers[0]!.id;
}

export default function PackingPage() {
  const { state, dispatch, loaded } = usePacking();
  const [traveler, setTraveler] = useState<TravelerId>(initialProfile);
  const [filters, setFilters] = useState<Filters>(initialFilters);
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

  return (
    <>
      <PageHeader
        title="Packing lists"
        subtitle="Everyone has their own list. Tick things off as you pack."
      />
      <ProfileSwitcher
        profiles={TRAVELER_PROFILES}
        selected={traveler}
        onSelect={selectTraveler}
        summaries={summaries}
      />

      {/* Everything below depends on the saved lists; render it in one go to avoid layout shift. */}
      {!loaded ? (
        <p class="page-loading" role="status">
          Loading…
        </p>
      ) : (
        <>
          <ProgressSummary
            id="pack-summary-title"
            title={`${name}’s list`}
            done={stats.packed}
            total={stats.total}
            doneLabel="packed"
            badge={stats.needToBuy > 0 ? `${stats.needToBuy} to buy` : undefined}
            ariaLabel={`${name}: ${stats.packed} of ${stats.total} items packed`}
          />

          {!state.templateDecided[traveler] && (
            <TemplateOffer
              heading={`Want a head start, ${name}?`}
              description={`Add ${PACKING_TEMPLATE.length} common ski-trip items: layers, gloves, sunscreen, chargers and more. You can edit or delete any of them.`}
              emoji="🎒"
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

          <p id={OWNERSHIP_HINT_ID} class="visually-hidden">
            Switches the item between Have and To buy.
          </p>
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
            fileStem="gudauri-packing"
            scope="all four lists"
            fileKind="a packing list"
            serialize={(now) => serializeExport(state, now)}
            parse={parsePackingBackup}
            onImport={(imported) => dispatch({ type: 'replaceAll', state: imported })}
          />
        </>
      )}
    </>
  );
}
