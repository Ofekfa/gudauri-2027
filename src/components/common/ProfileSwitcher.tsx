import { AvatarFace } from '../../avatars/Avatar';
import { CHARACTERS } from '../../data/characters';
import { trip, type TravelerId } from '../../data/trip';

interface ProfileSwitcherProps {
  selected: TravelerId;
  onSelect: (id: TravelerId) => void;
  /** e.g. "12/30" under each name. */
  summaries: Record<TravelerId, string>;
}

export function ProfileSwitcher({ selected, onSelect, summaries }: ProfileSwitcherProps) {
  return (
    <div class="profiles" role="group" aria-label="Whose list">
      {trip.travelers.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          class="profile"
          aria-pressed={selected === id}
          style={{ '--member-color': CHARACTERS[id].jacket }}
          onClick={() => onSelect(id)}
        >
          <AvatarFace id={id} size={48} decorative />
          <span class="profile__name">{name}</span>
          <span class="profile__summary">{summaries[id]}</span>
        </button>
      ))}
    </div>
  );
}
