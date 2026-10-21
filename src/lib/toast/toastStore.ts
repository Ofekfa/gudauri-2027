/** Tiny framework-free toast queue. UI subscribes; tests drive it with fake timers. */

export interface ToastAction {
  label: string;
  onSelect: () => void;
}

export interface Toast {
  id: number;
  message: string;
  title?: string;
  /** Decorative leading emoji. */
  emoji?: string;
  action?: ToastAction;
}

export interface ToastOptions extends Omit<Toast, 'id'> {
  durationMs?: number;
}

export const DEFAULT_TOAST_MS = 5_000;
/** Older toasts are dropped beyond this so they never stack up over content. */
export const MAX_VISIBLE_TOASTS = 2;

type Listener = (toasts: readonly Toast[]) => void;

export function createToastStore(
  timers: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'> = globalThis,
) {
  let toasts: Toast[] = [];
  let nextId = 1;
  const listeners = new Set<Listener>();
  const handles = new Map<number, ReturnType<typeof setTimeout>>();

  const emit = () => listeners.forEach((l) => l(toasts));

  function dismiss(id: number) {
    const handle = handles.get(id);
    if (handle !== undefined) timers.clearTimeout(handle);
    handles.delete(id);
    const next = toasts.filter((t) => t.id !== id);
    if (next.length !== toasts.length) {
      toasts = next;
      emit();
    }
  }

  function show({ durationMs = DEFAULT_TOAST_MS, ...toast }: ToastOptions): number {
    const id = nextId++;
    toasts = [...toasts, { ...toast, id }];
    while (toasts.length > MAX_VISIBLE_TOASTS) dismissSilently(toasts[0]!.id);
    handles.set(
      id,
      timers.setTimeout(() => dismiss(id), durationMs),
    );
    emit();
    return id;
  }

  function dismissSilently(id: number) {
    const handle = handles.get(id);
    if (handle !== undefined) timers.clearTimeout(handle);
    handles.delete(id);
    toasts = toasts.filter((t) => t.id !== id);
  }

  return {
    show,
    dismiss,
    getAll: (): readonly Toast[] => toasts,
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type ToastStore = ReturnType<typeof createToastStore>;

export const toasts = createToastStore();
