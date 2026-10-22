import { trip, type TravelerId } from '../../data/trip';

/** "· Maya" after an item someone else changed last (read as ", changed by Maya"). */
export function ChangedBy({ who }: { who?: TravelerId | null }) {
  const name = who ? trip.travelers.find((t) => t.id === who)?.name : null;
  if (!name) return null;
  return (
    <span class="changed-by">
      <span class="visually-hidden">, changed by </span>
      <span aria-hidden="true"> · </span>
      {name}
    </span>
  );
}
