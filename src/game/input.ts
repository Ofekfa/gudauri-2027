import type { GameInput } from './engine';

export type GameAction = 'primary' | 'pause';

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const PRIMARY_KEYS = new Set(['Space', 'Enter']);

/**
 * Keyboard (arrows / A-D, P or Esc to pause, Space or Enter to start) and touch:
 * hold the left or right half of the field to steer. Multi-touch safe.
 */
export function createInput(
  field: HTMLElement,
  onAction: (action: GameAction) => void,
  isPlaying: () => boolean,
) {
  const input: GameInput = { left: false, right: false };
  const keys = { left: false, right: false };
  const pointers = new Map<number, 'left' | 'right'>();

  const sync = () => {
    let touchLeft = false;
    let touchRight = false;
    for (const side of pointers.values()) {
      if (side === 'left') touchLeft = true;
      else touchRight = true;
    }
    input.left = keys.left || touchLeft;
    input.right = keys.right || touchRight;
  };

  const sideOf = (clientX: number): 'left' | 'right' => {
    const rect = field.getBoundingClientRect();
    return clientX < rect.left + rect.width / 2 ? 'left' : 'right';
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // Let buttons handle their own Space/Enter.
    const onButton = e.target instanceof HTMLButtonElement;
    if (LEFT_KEYS.has(e.code)) keys.left = true;
    else if (RIGHT_KEYS.has(e.code)) keys.right = true;
    else if (PAUSE_KEYS.has(e.code)) onAction('pause');
    else if (PRIMARY_KEYS.has(e.code) && !onButton) onAction('primary');
    else return;
    // Don't scroll the page with arrows/space while skiing.
    if (isPlaying() || PRIMARY_KEYS.has(e.code)) e.preventDefault();
    sync();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (LEFT_KEYS.has(e.code)) keys.left = false;
    else if (RIGHT_KEYS.has(e.code)) keys.right = false;
    else return;
    sync();
  };
  const onPointerDown = (e: PointerEvent) => {
    if (!isPlaying()) return;
    try {
      // Keeps receiving moves if the finger slides off the field; best-effort.
      field.setPointerCapture(e.pointerId);
    } catch {
      /* Not capturable (e.g. pointer already released): steering still works. */
    }
    pointers.set(e.pointerId, sideOf(e.clientX));
    sync();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, sideOf(e.clientX));
    sync();
  };
  const onPointerEnd = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    sync();
  };
  /** Clear held keys/touches (e.g. on blur) so the skier doesn't keep turning. */
  const release = () => {
    keys.left = keys.right = false;
    pointers.clear();
    sync();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', release);
  field.addEventListener('pointerdown', onPointerDown);
  field.addEventListener('pointermove', onPointerMove);
  field.addEventListener('pointerup', onPointerEnd);
  field.addEventListener('pointercancel', onPointerEnd);

  return {
    state: input,
    release,
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', release);
      field.removeEventListener('pointerdown', onPointerDown);
      field.removeEventListener('pointermove', onPointerMove);
      field.removeEventListener('pointerup', onPointerEnd);
      field.removeEventListener('pointercancel', onPointerEnd);
    },
  };
}
