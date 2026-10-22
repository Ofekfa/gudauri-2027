import type { Diet } from '../../lib/food/types';

const SPICY_LABEL = ['', 'Mildly spicy', 'Spicy', 'Very spicy'] as const;

/** Short, text-labelled badges (emoji are decorative). */
export function DietBadges({ diet }: { diet: Diet }) {
  const badges: { key: string; emoji: string; label: string }[] = [];
  if (diet.vegan) badges.push({ key: 'vegan', emoji: '🌿', label: 'Vegan' });
  else if (diet.vegetarian) badges.push({ key: 'veg', emoji: '🌱', label: 'Vegetarian' });
  else if (diet.vegetarianOption)
    badges.push({ key: 'veg-option', emoji: '🌱', label: 'Veg option' });
  if (diet.nuts) badges.push({ key: 'nuts', emoji: '🥜', label: 'Contains nuts' });
  if (diet.spicy > 0) badges.push({ key: 'spicy', emoji: '🌶️', label: SPICY_LABEL[diet.spicy] });
  if (badges.length === 0) return null;
  return (
    <ul class="diet-badges">
      {badges.map((b) => (
        <li key={b.key} class={`diet-badge diet-badge--${b.key}`}>
          <span aria-hidden="true">{b.emoji}</span> {b.label}
        </li>
      ))}
    </ul>
  );
}
