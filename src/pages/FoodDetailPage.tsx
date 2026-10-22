import { useEffect } from 'preact/hooks';
import type { ParamPageProps } from '../app';
import { DietBadges } from '../components/food/DietBadges';
import { DishPhoto } from '../components/food/DishPhoto';
import { WordCardBody } from '../components/facts/WordCard';
import { PageHeader } from '../components/PageHeader';
import { DISH_IMAGES } from '../data/dishImages';
import { findDish, ORDERING_PHRASE_IDS } from '../data/dishes';
import { FACTS } from '../data/facts';
import { trip } from '../data/trip';
import { isWordFact } from '../lib/facts/types';
import { rememberDish } from '../lib/food/lastViewed';
import { CATEGORY_LABEL } from '../lib/food/types';
import { href } from '../lib/router/hashRouter';

const FOOD_BACK = { path: '/food', label: 'All dishes' };
const HERO_SIZES = '(min-width: 56rem) 46rem, 100vw';
const PHRASES = ORDERING_PHRASE_IDS.map((id) => FACTS.find((f) => f.id === id)).filter(
  (f): f is Extract<(typeof FACTS)[number], { topic: 'words' }> => f !== undefined && isWordFact(f),
);

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

export default function FoodDetailPage({ param }: ParamPageProps) {
  const dish = findDish(param);

  useEffect(() => {
    if (!dish) return;
    rememberDish(dish.id);
    document.title = `${dish.name} · Georgian food · ${trip.name}`;
  }, [dish]);

  if (!dish) {
    return (
      <>
        <PageHeader title="Dish not found" back={FOOD_BACK} />
        <p class="card">
          We don’t have that dish. <a href={href('/food')}>See all Georgian dishes</a>.
        </p>
      </>
    );
  }

  const image = DISH_IMAGES.find((i) => i.id === dish.id);
  const facts = (dish.relatedFactIds ?? [])
    .map((id) => FACTS.find((f) => f.id === id))
    .filter((f) => f !== undefined);

  return (
    <article class="dish">
      <PageHeader title={dish.name} subtitle={dish.nameEn} back={FOOD_BACK} />
      <p class="dish__names">
        <span class="dish__ka" lang="ka">
          {dish.nameKa}
        </span>
        <span class="dish__translit">{dish.transliteration}</span>
      </p>

      <figure class="dish__hero">
        <DishPhoto dish={dish} sizes={HERO_SIZES} eager />
        {image && (
          <figcaption class="dish__credit">
            Photo: {image.author},{' '}
            {image.licenseUrl ? (
              <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">
                {image.license}
              </a>
            ) : (
              image.license
            )}
            , via{' '}
            <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
              Wikimedia Commons
            </a>
            . {image.modified}.
          </figcaption>
        )}
      </figure>

      <p class="dish__meta">
        {CATEGORY_LABEL[dish.category]}
        {dish.region && ` · ${dish.region}`}
      </p>
      <DietBadges diet={dish.diet} />
      <p class="dish__description">{dish.description}</p>
      {dish.dietNote && (
        <p class="note">
          <span aria-hidden="true">ℹ️</span> {dish.dietNote}
        </p>
      )}

      <section class="card dish__section" aria-labelledby="dish-ingredients">
        <h2 id="dish-ingredients">What’s in it</h2>
        <ul class="dish__ingredients">
          {dish.ingredients.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>

      {dish.howToEat && (
        <section class="card dish__section" aria-labelledby="dish-eat">
          <h2 id="dish-eat">How to eat or order it</h2>
          <p>{dish.howToEat}</p>
        </section>
      )}

      {dish.funFact && (
        <section class="card dish__section" aria-labelledby="dish-fun">
          <h2 id="dish-fun">Did you know?</h2>
          <p>{dish.funFact}</p>
        </section>
      )}

      {facts.length > 0 && (
        <section class="dish__section" aria-labelledby="dish-facts">
          <h2 id="dish-facts" class="section-title">
            Related fun facts
          </h2>
          <ul class="dish__facts">
            {facts.map((fact) => (
              <li key={fact.id} class="card">
                <h3>{fact.title}</h3>
                <p>{fact.text}</p>
                <a href={fact.source} target="_blank" rel="noopener noreferrer">
                  Source: {hostOf(fact.source)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="dish__section" aria-labelledby="dish-phrases">
        <h2 id="dish-phrases" class="section-title">
          Useful phrases for ordering
        </h2>
        <ul class="dish__phrases">
          {PHRASES.map((fact) => (
            <li key={fact.id} class="card">
              <WordCardBody fact={fact} headingLevel={3} />
            </li>
          ))}
        </ul>
      </section>

      <p class="rates-meta">
        Sources:{' '}
        {dish.sources.map((url, i) => (
          <span key={url}>
            {i > 0 && ' · '}
            <a href={url} target="_blank" rel="noopener noreferrer">
              {hostOf(url)}
            </a>
          </span>
        ))}
      </p>
    </article>
  );
}
