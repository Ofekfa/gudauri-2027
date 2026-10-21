import { TRAVELER_PROFILES, type Profile } from '../common/ProfileSwitcher';
import { Icon } from '../Icon';
import { trip } from '../../data/trip';
import { SHARED_LIST, type TodoListId } from '../../lib/todo/model';

const SHARED_COLOR = '#1059a8';

/** The four travelers plus the group "Shared" list. */
export const TODO_PROFILES: Profile<TodoListId>[] = [
  ...TRAVELER_PROFILES,
  {
    id: SHARED_LIST,
    label: 'Shared',
    color: SHARED_COLOR,
    avatar: (
      <span class="profile__group-avatar" aria-hidden="true">
        <Icon name="users" size={26} />
      </span>
    ),
  },
];

export const TODO_PROFILE_KEY = 'todo:profile';

export function listLabel(id: TodoListId): string {
  return id === SHARED_LIST ? 'Shared' : (trip.travelers.find((t) => t.id === id)?.name ?? id);
}
