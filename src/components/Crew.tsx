import { AvatarFace, AvatarSkier } from '../avatars/Avatar';
import { CHARACTERS } from '../data/characters';
import { trip } from '../data/trip';

interface CrewProps {
  /** Show the skiing pose instead of the portrait. */
  skiing?: boolean;
}

export function Crew({ skiing = false }: CrewProps) {
  return (
    <ul class="crew">
      {trip.travelers.map(({ id, name }) => (
        <li key={id} class="crew__member" style={{ '--member-color': CHARACTERS[id].jacket }}>
          {skiing ? (
            <AvatarSkier id={id} size={72} decorative />
          ) : (
            <AvatarFace id={id} size={72} decorative />
          )}
          <span class="crew__name">{name}</span>
        </li>
      ))}
    </ul>
  );
}
