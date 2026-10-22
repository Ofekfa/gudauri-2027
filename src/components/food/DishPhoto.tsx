import { useState } from 'preact/hooks';
import { DISH_IMAGE_WIDTHS, dishImage } from '../../data/dishImages';
import type { Dish } from '../../lib/food/types';
import { DishIllustration } from './DishIllustration';

const BASE = `${import.meta.env.BASE_URL}food/`;
const srcset = (id: string, format: string) =>
  DISH_IMAGE_WIDTHS.map((w) => `${BASE}${id}-${w}.${format} ${w}w`).join(', ');

interface DishPhotoProps {
  dish: Dish;
  /** Layout width hint for picking a size, e.g. "(min-width: 56rem) 14rem, 45vw". */
  sizes: string;
  /** The detail hero loads eagerly; cards lazily. */
  eager?: boolean;
  /** Cards are labelled by their names, so their photo is decorative. */
  decorative?: boolean;
}

/** A 4:3 responsive photo (AVIF, then WebP); falls back to the illustration offline or when missing. */
export function DishPhoto({ dish, sizes, eager = false, decorative = false }: DishPhotoProps) {
  const image = dishImage(dish.id);
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <DishIllustration
        category={dish.category}
        emoji={dish.emoji}
        label={decorative ? undefined : `Illustration for ${dish.name} (no photo available)`}
      />
    );
  }
  return (
    <picture>
      <source type="image/avif" srcSet={srcset(image.id, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcset(image.id, 'webp')} sizes={sizes} />
      <img
        class="dish-photo"
        src={`${BASE}${image.id}-${DISH_IMAGE_WIDTHS[0]}.webp`}
        width={image.width}
        height={image.height}
        alt={decorative ? '' : image.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </picture>
  );
}
