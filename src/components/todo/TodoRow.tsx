import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { dateInputToDue, dueToDateInput, formatDue, TODO_TIME_ZONE } from '../../lib/todo/due';
import {
  MAX_NOTE_LENGTH,
  MAX_TITLE_LENGTH,
  TODO_CATEGORIES,
  TODO_CATEGORY_EMOJI,
  TODO_CATEGORY_LABEL,
  type TodoCategory,
  type TodoItem,
} from '../../lib/todo/model';
import type { TodoPatch } from '../../lib/todo/reducer';
import { dueStatus, dueStatusLabel } from '../../lib/todo/selectors';
import { Icon } from '../Icon';

interface TodoRowProps {
  item: TodoItem;
  now: number;
  onToggle: () => void;
  onSave: (patch: TodoPatch) => void;
  onDelete: () => void;
  /** Extra line under the title (e.g. the live packing count). */
  extra?: ComponentChildren;
}

export function TodoRow({ item, now, onToggle, onSave, onDelete, extra }: TodoRowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [note, setNote] = useState(item.note ?? '');
  const [category, setCategory] = useState(item.category);
  const [day, setDay] = useState(item.dueBy ? dueToDateInput(item.dueBy) : '');
  const titleRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const checkboxId = `todo-${item.id}`;

  useEffect(() => {
    if (editing) titleRef.current?.select();
    else if (wasEditing.current) editButtonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const startEditing = () => {
    setTitle(item.title);
    setNote(item.note ?? '');
    setCategory(item.category);
    setDay(item.dueBy ? dueToDateInput(item.dueBy) : '');
    setEditing(true);
  };
  const cancelOnEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <li class="pack-item pack-item--editing">
        <form
          class="todo-editor"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              title,
              note,
              category,
              dueBy: day ? dateInputToDue(day, item.dueBy) : null,
            });
            setEditing(false);
          }}
        >
          <label class="todo-editor__field">
            <span>Title</span>
            <input
              ref={titleRef}
              type="text"
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onInput={(e) => setTitle(e.currentTarget.value)}
              onKeyDown={cancelOnEscape}
            />
          </label>
          <label class="todo-editor__field">
            <span>Note (optional)</span>
            <input
              type="text"
              maxLength={MAX_NOTE_LENGTH}
              value={note}
              onInput={(e) => setNote(e.currentTarget.value)}
              onKeyDown={cancelOnEscape}
            />
          </label>
          <div class="todo-editor__row">
            <label class="todo-editor__field">
              <span>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.currentTarget.value as TodoCategory)}
                onKeyDown={cancelOnEscape}
              >
                {TODO_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TODO_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label class="todo-editor__field">
              <span>Due (Israel time)</span>
              <input
                type="date"
                value={day}
                onInput={(e) => setDay(e.currentTarget.value)}
                onKeyDown={cancelOnEscape}
              />
            </label>
          </div>
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

  const status = item.dueBy ? dueStatus(item.dueBy, now, TODO_TIME_ZONE) : null;
  const urgent = !item.done && (status?.kind === 'overdue' || status?.kind === 'today');

  return (
    <li class={`pack-item todo-item${item.done ? ' is-packed' : ''}`}>
      <input
        id={checkboxId}
        type="checkbox"
        class="pack-item__check"
        checked={item.done}
        onChange={onToggle}
      />
      <div class="todo-item__body">
        <label htmlFor={checkboxId} class="pack-item__name todo-item__title">
          {item.title}
        </label>
        <p class="todo-item__meta">
          <span aria-hidden="true">{TODO_CATEGORY_EMOJI[item.category]} </span>
          {TODO_CATEGORY_LABEL[item.category]}
          {item.dueBy && (
            <>
              {' · '}
              {formatDue(item.dueBy)}
              {status && !item.done && (
                <span class={`todo-due${urgent ? ' todo-due--urgent' : ''}`}>
                  {dueStatusLabel(status)}
                </span>
              )}
            </>
          )}
        </p>
        {item.note && <p class="todo-item__note">{item.note}</p>}
        {extra}
      </div>
      <button
        ref={editButtonRef}
        type="button"
        class="icon-button"
        aria-label={`Edit ${item.title}`}
        onClick={startEditing}
      >
        <Icon name="pencil" size={18} />
      </button>
      <button
        type="button"
        class="icon-button icon-button--danger"
        aria-label={`Delete ${item.title}`}
        onClick={onDelete}
      >
        <Icon name="trash" size={18} />
      </button>
    </li>
  );
}
