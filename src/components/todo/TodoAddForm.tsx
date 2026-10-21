import type { RefObject } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { dateInputToDue } from '../../lib/todo/due';
import {
  MAX_TITLE_LENGTH,
  TODO_CATEGORIES,
  TODO_CATEGORY_LABEL,
  type TodoCategory,
} from '../../lib/todo/model';
import type { NewTodo } from '../../lib/todo/reducer';
import { Icon } from '../Icon';

interface TodoAddFormProps {
  defaultCategory: TodoCategory;
  onAdd: (item: NewTodo) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function TodoAddForm({ defaultCategory, onAdd, inputRef }: TodoAddFormProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TodoCategory>(defaultCategory);
  const [day, setDay] = useState('');
  const fallbackRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? fallbackRef;

  const submit = (event: Event) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAdd({ title, category, ...(day ? { dueBy: dateInputToDue(day) } : {}) });
    setTitle('');
    setDay('');
    ref.current?.focus();
  };

  return (
    <form class="add-item card" onSubmit={submit}>
      <label class="visually-hidden" htmlFor="add-todo-title">
        New to-do
      </label>
      <input
        id="add-todo-title"
        ref={ref}
        class="add-item__name"
        type="text"
        placeholder="Add a to-do, e.g. Renew passport"
        autocomplete="off"
        enterKeyHint="done"
        maxLength={MAX_TITLE_LENGTH}
        value={title}
        onInput={(e) => setTitle(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Escape' && setTitle('')}
      />
      <div class="add-item__options">
        <label>
          <span class="visually-hidden">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.currentTarget.value as TodoCategory)}
          >
            {TODO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TODO_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span class="visually-hidden">Due date (Israel time, optional)</span>
          <input type="date" value={day} onInput={(e) => setDay(e.currentTarget.value)} />
        </label>
        <button type="submit" class="button button--primary" disabled={!title.trim()}>
          <Icon name="plus" size={18} />
          Add
        </button>
      </div>
    </form>
  );
}
