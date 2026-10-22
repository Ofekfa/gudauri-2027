import { useState } from 'preact/hooks';
import type { Moment } from '../../lib/album/moments';
import {
  MAX_MOMENT_PROMPT,
  MAX_MOMENT_TITLE,
  MOMENT_EMOJIS,
  type MomentInput,
} from '../../lib/album/protocol';

interface MomentFormProps {
  idPrefix: string;
  /** Story order, for "Place after". */
  moments: readonly Moment[];
  initial: MomentInput;
  /** Editing this moment: it's left out of "Place after". */
  editingId?: string;
  submitLabel: string;
  onSubmit(input: MomentInput): Promise<boolean>;
  onCancel(): void;
}

/** Inline form for one of our own moments: title, emoji, prompt and where it goes. */
export function MomentForm({
  idPrefix,
  moments,
  initial,
  editingId,
  submitLabel,
  onSubmit,
  onCancel,
}: MomentFormProps) {
  const [title, setTitle] = useState(initial.title);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [prompt, setPrompt] = useState(initial.prompt ?? '');
  const [after, setAfter] = useState(initial.after);
  const [saving, setSaving] = useState(false);
  const places = moments.filter((m) => m.id !== editingId);

  return (
    <form
      class="moment-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || saving) return;
        setSaving(true);
        const done = await onSubmit({ title: title.trim(), emoji, prompt: prompt.trim(), after });
        setSaving(false);
        if (done) onCancel();
      }}
    >
      <label class="moment-form__field" htmlFor={`${idPrefix}-title`}>
        Title
        <input
          id={`${idPrefix}-title`}
          required
          maxLength={MAX_MOMENT_TITLE}
          value={title}
          placeholder="Breakfast"
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
      </label>
      <fieldset class="moment-form__emoji">
        <legend>Emoji</legend>
        <div class="moment-form__emoji-grid">
          {MOMENT_EMOJIS.map((e) => (
            <label key={e.emoji} class="moment-form__emoji-option">
              <input
                type="radio"
                class="visually-hidden"
                name={`${idPrefix}-emoji`}
                value={e.emoji}
                checked={emoji === e.emoji}
                onChange={() => setEmoji(e.emoji)}
              />
              <span aria-hidden="true">{e.emoji}</span>
              <span class="visually-hidden">{e.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label class="moment-form__field" htmlFor={`${idPrefix}-prompt`}>
        Prompt (optional)
        <input
          id={`${idPrefix}-prompt`}
          maxLength={MAX_MOMENT_PROMPT}
          value={prompt}
          placeholder="Who had the most khachapuri?"
          onInput={(e) => setPrompt(e.currentTarget.value)}
        />
      </label>
      <label class="moment-form__field" htmlFor={`${idPrefix}-after`}>
        Place after
        <select
          id={`${idPrefix}-after`}
          value={after}
          onChange={(e) => setAfter(e.currentTarget.value)}
        >
          {places.map((m) => (
            <option key={m.id} value={m.id}>
              {m.emoji} {m.title}
            </option>
          ))}
        </select>
      </label>
      <div class="button-row">
        <button type="submit" class="button button--primary" disabled={!title.trim() || saving}>
          {submitLabel}
        </button>
        <button type="button" class="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
