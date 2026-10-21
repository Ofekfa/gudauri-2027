import type { ComponentChild } from 'preact';
import { AvatarFace } from '../../avatars/Avatar';
import { CHARACTERS } from '../../data/characters';
import { trip, type TravelerId } from '../../data/trip';

export interface Profile<Id extends string> {
  id: Id;
  label: string;
  /** Accent color for the selected outline. */
  color: string;
  avatar: ComponentChild;
}

const AVATAR_SIZE = 48;

/** The four travelers as switcher profiles (lists can append extra ones, e.g. "Shared"). */
export const TRAVELER_PROFILES: Profile<TravelerId>[] = trip.travelers.map(({ id, name }) => ({
  id,
  label: name,
  color: CHARACTERS[id].jacket,
  avatar: <AvatarFace id={id} size={AVATAR_SIZE} decorative />,
}));

interface ProfileSwitcherProps<Id extends string> {
  profiles: Profile<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
  /** e.g. "12/30" under each name. */
  summaries: Partial<Record<Id, string>>;
  ariaLabel?: string;
}

export function ProfileSwitcher<Id extends string>({
  profiles,
  selected,
  onSelect,
  summaries,
  ariaLabel = 'Whose list',
}: ProfileSwitcherProps<Id>) {
  return (
    <div class="profiles" role="group" aria-label={ariaLabel}>
      {profiles.map(({ id, label, color, avatar }) => (
        <button
          key={id}
          type="button"
          class="profile"
          aria-pressed={selected === id}
          style={{ '--member-color': color }}
          onClick={() => onSelect(id)}
        >
          {avatar}
          <span class="profile__name">{label}</span>
          <span class="profile__summary">{summaries[id]}</span>
        </button>
      ))}
    </div>
  );
}
