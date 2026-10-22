import { useEffect, useRef } from 'preact/hooks';
import { detectSwipe, keyToDirection, type SwipeDirection } from '../../lib/facts/carousel';

/** Arrow keys shouldn't hijack typing or native controls that use them. */
const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Arrow keys anywhere on the page and swipes on the stage (same as Fun facts). */
export function useCarousel(go: (dir: SwipeDirection) => void, enabled: boolean) {
  const goRef = useRef(go);
  goRef.current = go;
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;
      const dir = keyToDirection(event.key);
      if (!dir) return;
      event.preventDefault();
      goRef.current(dir);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);

  return {
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
