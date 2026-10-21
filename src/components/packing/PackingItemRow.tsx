import { useEffect, useRef, useState } from 'preact/hooks';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  MAX_ITEM_NAME_LENGTH,
  type Category,
  type PackingItem,
} from '../../lib/packing/model';
import { Icon } from '../Icon';

/** Id of the shared, visually hidden explanation of the Have/To buy toggle (rendered by the page). */
export const OWNERSHIP_HINT_ID = 'ownership-toggle-hint';

interface PackingItemRowProps {
  item: PackingItem;
  onTogglePacked: () => void;
  onToggleOwnership: () => void;
  onSave: (name: string, category: Category) => void;
  onDelete: () => void;
}

export function PackingItemRow({
  item,
  onTogglePacked,
  onToggleOwnership,
  onSave,
  onDelete,
}: PackingItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(item.name);
  const [draftCategory, setDraftCategory] = useState(item.category);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const checkboxId = `pack-${item.id}`;
  const needToBuy = item.ownership === 'need-to-buy';

  useEffect(() => {
    if (editing) nameInputRef.current?.select();
    // Return focus to the row after closing the editor.
    else if (wasEditing.current) editButtonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const startEditing = () => {
    setDraftName(item.name);
    setDraftCategory(item.category);
    setEditing(true);
  };

  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <li class="pack-item pack-item--editing">
        <form
          class="pack-item__editor"
          onSubmit={(e) => {
            e.preventDefault();
            if (draftName.trim()) onSave(draftName, draftCategory);
            setEditing(false);
          }}
        >
          <label class="visually-hidden" htmlFor={`edit-${item.id}`}>
            Item name
          </label>
          <input
            id={`edit-${item.id}`}
            ref={nameInputRef}
            type="text"
            maxLength={MAX_ITEM_NAME_LENGTH}
            value={draftName}
            onInput={(e) => setDraftName(e.currentTarget.value)}
            onKeyDown={cancelOnEscape}
          />
          <label>
            <span class="visually-hidden">Category</span>
            <select
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.currentTarget.value as Category)}
              onKeyDown={cancelOnEscape}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <div class="pack-item__editor-actions">
            <button type="submit" class="button button--primary">
              Save
            </button>
            <button type="button" class="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li class={`pack-item${item.packed ? ' is-packed' : ''}`}>
      <input
        id={checkboxId}
        type="checkbox"
        class="pack-item__check"
        checked={item.packed}
        onChange={onTogglePacked}
      />
      <label htmlFor={checkboxId} class="pack-item__name">
        {item.name}
      </label>
      <button
        type="button"
        class={`ownership-chip${needToBuy ? ' ownership-chip--buy' : ''}`}
        // The accessible name starts with the visible text so voice control ("click Have") works.
        aria-label={`${needToBuy ? 'To buy' : 'Have'}: ${item.name}`}
        aria-describedby={OWNERSHIP_HINT_ID}
        onClick={onToggleOwnership}
      >
        {needToBuy ? (
          <>
            <Icon name="cart" size={14} /> To buy
          </>
        ) : (
          'Have'
        )}
      </button>
      <button
        ref={editButtonRef}
        type="button"
        class="icon-button"
        aria-label={`Edit ${item.name}`}
        onClick={startEditing}
      >
        <Icon name="pencil" size={18} />
      </button>
      <button
        type="button"
        class="icon-button icon-button--danger"
        aria-label={`Delete ${item.name}`}
        onClick={onDelete}
      >
        <Icon name="trash" size={18} />
      </button>
    </li>
  );
}
