import { useEffect, useRef } from 'preact/hooks';
import { detectSwipe, keyToDirection, type SwipeDirection } from '../../lib/facts/carousel';

/** Arrow keys shouldn't hijack typing or native controls that use them. */
const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Swipes on the stage plus arrow keys (same as Fun facts). Keys work anywhere
 * on the page by default; with `keys: 'element'` only while focus is inside the
 * element that gets the returned `onKeyDown` (e.g. one card among many).
 */
export function useCarousel(
  go: (dir: SwipeDirection) => void,
  enabled: boolean,
  keys: 'document' | 'element' = 'document',
) {
  const goRef = useRef(go);
  goRef.current = go;
  const start = useRef<{ x: number; y: number } | null>(null);

  const onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
    const dir = keyToDirection(event.key);
    if (!dir) return;
    event.preventDefault();
    goRef.current(dir);
  };

  useEffect(() => {
    if (!enabled || keys !== 'document') return;
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, keys]);

  return {
    onKeyDown: enabled && keys === 'element' ? onKey : undefined,
    onPointerDown: (e: PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      const dir = s && enabled ? detectSwipe(e.clientX - s.x, e.clientY - s.y) : null;
      if (dir) goRef.current(dir);
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
