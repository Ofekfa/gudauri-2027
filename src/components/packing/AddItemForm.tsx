import type { RefObject } from 'preact';
import { useRef, useState } from 'preact/hooks';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  MAX_ITEM_NAME_LENGTH,
  OWNERSHIPS,
  OWNERSHIP_LABEL,
  type Category,
  type Ownership,
} from '../../lib/packing/model';
import type { NewItem } from '../../lib/packing/reducer';
import { Icon } from '../Icon';

interface AddItemFormProps {
  defaultCategory: Category;
  onAdd: (item: NewItem) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function AddItemForm({ defaultCategory, onAdd, inputRef }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [ownership, setOwnership] = useState<Ownership>('have');
  const fallbackRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? fallbackRef;

  const submit = (event: Event) => {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd({ name, category, ownership });
    setName('');
    ref.current?.focus();
  };

  return (
    <form class="add-item card" onSubmit={submit}>
      <label class="visually-hidden" htmlFor="add-item-name">
        New item
      </label>
      <input
        id="add-item-name"
        ref={ref}
        class="add-item__name"
        type="text"
        placeholder="Add an item, e.g. Ski socks"
        autocomplete="off"
        enterKeyHint="done"
        maxLength={MAX_ITEM_NAME_LENGTH}
        value={name}
        onInput={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Escape' && setName('')}
      />
      <div class="add-item__options">
        <label>
          <span class="visually-hidden">Category</span>
          <select value={category} onChange={(e) => setCategory(e.currentTarget.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span class="visually-hidden">Status</span>
          <select
            value={ownership}
            onChange={(e) => setOwnership(e.currentTarget.value as Ownership)}
          >
            {OWNERSHIPS.map((o) => (
              <option key={o} value={o}>
                {OWNERSHIP_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" class="button button--primary" disabled={!name.trim()}>
          <Icon name="plus" size={18} />
          Add
        </button>
      </div>
    </form>
  );
}
