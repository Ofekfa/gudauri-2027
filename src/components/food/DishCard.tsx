import type { Dish } from '../../lib/food/types';
import { href } from '../../lib/router/hashRouter';
import { DietBadges } from './DietBadges';
import { DishPhoto } from './DishPhoto';

/** Card width: two columns on phones, three on desktop. */
const CARD_SIZES = '(min-width: 56rem) 15rem, 46vw';

export function DishCard({ dish }: { dish: Dish }) {
  return (
    <li class="dish-card">
      <a id={`dish-${dish.id}`} class="dish-card__link" href={href(`/food/${dish.id}`)}>
        <span class="dish-card__media">
          <DishPhoto dish={dish} sizes={CARD_SIZES} decorative />
        </span>
        <span class="dish-card__body">
          <span class="dish-card__name">{dish.name}</span>
          <span class="dish-card__en">{dish.nameEn}</span>
          <span class="dish-card__ka" lang="ka">
            {dish.nameKa}
          </span>
        </span>
      </a>
      <DietBadges diet={dish.diet} />
    </li>
  );
}
