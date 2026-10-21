import { useEffect, useState } from 'preact/hooks';
import { toasts as toastStore, type Toast } from '../lib/toast/toastStore';

/**
 * Renders the toast queue in a corner region that sits above the mobile tab bar,
 * so it never covers navigation. Each toast is a polite live region.
 */
export function ToastHost() {
  const [items, setItems] = useState<readonly Toast[]>(toastStore.getAll());
  useEffect(() => toastStore.subscribe(setItems), []);

  return (
    <section class="toasts" aria-label="Notifications">
      {items.map((toast) => (
        <div key={toast.id} class="toast" role="status">
          {toast.emoji && (
            <span class="toast__emoji" aria-hidden="true">
              {toast.emoji}
            </span>
          )}
          <div class="toast__body">
            {toast.title && <p class="toast__title">{toast.title}</p>}
            <p class="toast__message">{toast.message}</p>
          </div>
          {toast.action && (
            <button
              type="button"
              class="toast__action"
              onClick={() => {
                toast.action?.onSelect();
                toastStore.dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            class="toast__close"
            aria-label="Dismiss notification"
            onClick={() => toastStore.dismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </section>
  );
}
