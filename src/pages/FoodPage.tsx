import { useEffect, useMemo, useState } from 'preact/hooks';
import { DishCard } from '../components/food/DishCard';
import { PageHeader } from '../components/PageHeader';
import { DISHES } from '../data/dishes';
import { takeLastViewedDish } from '../lib/food/lastViewed';
import { href } from '../lib/router/hashRouter';
import { filterDishes, groupByCategory, hasActiveFilters } from '../lib/food/selectors';
import {
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  NO_FILTERS,
  type DishCategory,
  type DishFilters,
} from '../lib/food/types';

type DietFilter = 'vegetarian' | 'vegan' | 'noNuts';
const DIET_FILTERS: { key: DietFilter; label: string }[] = [
  { key: 'vegetarian', label: '🌱 Vegetarian' },
  { key: 'vegan', label: '🌿 Vegan' },
  { key: 'noNuts', label: 'No nuts' },
];

function jumpTo(category: DishCategory) {
  const heading = document.getElementById(`food-${category}`);
  heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  heading?.focus({ preventScroll: true });
}

export default function FoodPage() {
  const [filters, setFilters] = useState<DishFilters>(NO_FILTERS);
  const visible = useMemo(() => filterDishes(DISHES, filters), [filters]);
  const groups = useMemo(() => groupByCategory(visible), [visible]);
  const active = hasActiveFilters(filters);

  // Coming back from a dish: return to its card instead of the top of the page.
  useEffect(() => {
    const id = takeLastViewedDish();
    const card = id ? document.getElementById(`dish-${id}`) : null;
    if (!card) return;
    card.scrollIntoView({ block: 'center' });
    card.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <PageHeader
        title="Georgian food"
        subtitle="What to order, how to eat it and what’s in it: 38 dishes and drinks."
      />

      <div class="food-tools card">
        <label class="food-search" htmlFor="food-search">
          <span class="food-search__label">Search dishes</span>
          <input
            id="food-search"
            type="search"
            placeholder="khinkali, ხინკალი, cheese…"
            autoComplete="off"
            value={filters.query}
            onInput={(e) => {
              const query = e.currentTarget.value;
              setFilters((f) => ({ ...f, query }));
            }}
          />
        </label>
        <div class="filters__group" role="group" aria-label="Diet">
          {DIET_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              class="chip-button chip-button--small"
              aria-pressed={filters[key]}
              onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
            >
              {label}
            </button>
          ))}
        </div>
        <p class="food-count" aria-live="polite">
          {active ? `${visible.length} of ${DISHES.length} dishes` : `${DISHES.length} dishes`}
        </p>
      </div>

      {groups.length > 1 && (
        <nav class="food-jump" aria-label="Jump to category">
          <div class="filters__group">
            {groups.map(({ category }) => (
              <button
                key={category}
                type="button"
                class="chip-button chip-button--small"
                onClick={() => jumpTo(category)}
              >
                <span aria-hidden="true">{CATEGORY_EMOJI[category]}</span>{' '}
                {CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>
        </nav>
      )}

      {groups.length === 0 ? (
        <p class="empty-note">
          No dishes match.{' '}
          <button type="button" class="link-button" onClick={() => setFilters(NO_FILTERS)}>
            Clear search and filters
          </button>
        </p>
      ) : (
        groups.map(({ category, dishes }) => (
          <section key={category} class="food-section" aria-labelledby={`food-${category}`}>
            <h2 id={`food-${category}`} class="section-title food-section__title" tabIndex={-1}>
              <span aria-hidden="true">{CATEGORY_EMOJI[category]}</span> {CATEGORY_LABEL[category]}
            </h2>
            <ul class="dish-grid">
              {dishes.map((dish) => (
                <DishCard key={dish.id} dish={dish} />
              ))}
            </ul>
          </section>
        ))
      )}

      <p class="rates-meta">
        Written in our own words from the sources on each dish page. Photos from Wikimedia Commons;
        see <a href={href('/credits')}>Credits</a>.
      </p>
    </>
  );
}
