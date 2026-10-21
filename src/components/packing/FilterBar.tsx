import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABEL } from '../../lib/packing/model';
import {
  STATUS_FILTERS,
  STATUS_FILTER_LABEL,
  type CategoryFilter,
  type Filters,
} from '../../lib/packing/selectors';

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const CATEGORY_OPTIONS: CategoryFilter[] = ['all', ...CATEGORIES];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div class="filters">
      <div class="filters__group" role="group" aria-label="Filter by category">
        {CATEGORY_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            class="chip-button"
            aria-pressed={filters.category === c}
            onClick={() => onChange({ ...filters, category: c })}
          >
            {c === 'all' ? (
              'All categories'
            ) : (
              <>
                <span aria-hidden="true">{CATEGORY_EMOJI[c]}</span> {CATEGORY_LABEL[c]}
              </>
            )}
          </button>
        ))}
      </div>
      <div class="filters__group" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            class="chip-button chip-button--small"
            aria-pressed={filters.status === s}
            onClick={() => onChange({ ...filters, status: s })}
          >
            {STATUS_FILTER_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
