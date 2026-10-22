import { CATEGORY_EMOJI, type DishCategory } from '../../lib/food/types';

/**
 * Drawn stand-in for dishes without a properly licensed photo: the category
 * emoji on a plate, over the site's mountain motif. Never a mislabeled photo.
 */
interface DishIllustrationProps {
  category: DishCategory;
  /** Overrides the category emoji (e.g. 💧 for mineral water, not 🍷). */
  emoji?: string;
  label?: string;
}

export function DishIllustration({ category, emoji, label }: DishIllustrationProps) {
  return (
    <svg
      class={`dish-art dish-art--${category}`}
      viewBox="0 0 400 300"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width="400" height="300" class="dish-art__sky" />
      <path
        d="M0 210 L90 120 L150 170 L230 80 L320 160 L400 110 L400 300 L0 300 Z"
        class="dish-art__ridge"
      />
      <ellipse cx="200" cy="232" rx="130" ry="34" class="dish-art__shadow" />
      <ellipse cx="200" cy="224" rx="124" ry="38" class="dish-art__plate" />
      <ellipse cx="200" cy="222" rx="90" ry="25" class="dish-art__plate-inner" />
      <text x="200" y="196" text-anchor="middle" dominant-baseline="middle" class="dish-art__emoji">
        {emoji ?? CATEGORY_EMOJI[category]}
      </text>
    </svg>
  );
}
