import { useEffect, useRef } from 'preact/hooks';
import {
  createShuffleBag,
  FACT_TOAST_MS,
  initialFactDueAt,
  nextFactDueAt,
  shouldShowFact,
} from '../../lib/facts/rotation';
import { factSettings } from '../../lib/facts/settings';
import { TOPIC_EMOJI, type Fact } from '../../lib/facts/types';
import { toasts } from '../../lib/toast/toastStore';

/** How often to check whether a fact is due (cheap; the gate does the real limiting). */
const CHECK_INTERVAL_MS = 5_000;
/** Pages where a pop-up would get in the way (games, the facts page itself, input-heavy tools). */
const BLOCKED_PATHS = new Set(['/game', '/facts', '/currency']);

/** Invisible: occasionally shows a fun fact as a toast. */
export function FactPopups({ path }: { path: string }) {
  const dueAt = useRef(initialFactDueAt(Date.now(), factSettings.lastShownAt()));
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    // Fact data is loaded lazily so it never weighs on the first page load.
    let bag: { next(): Fact } | null = null;
    let cancelled = false;
    void import('../../data/facts')
      .then((m) => {
        if (!cancelled) bag = createShuffleBag(m.FACTS);
      })
      .catch(() => {
        /* Pop-ups are optional; stay quiet if the chunk fails to load. */
      });

    const check = () => {
      if (!bag) return;
      const now = Date.now();
      const show = shouldShowFact({
        now,
        dueAt: dueAt.current,
        muted: factSettings.isMuted(),
        pageHidden: document.hidden,
        routeBlocked: BLOCKED_PATHS.has(pathRef.current),
      });
      if (!show) return;
      const fact = bag.next();
      toasts.show({
        emoji: TOPIC_EMOJI[fact.topic],
        title: fact.title,
        message: fact.text,
        durationMs: FACT_TOAST_MS,
        action: {
          label: 'Mute',
          onSelect: () => {
            factSettings.setMuted(true);
            toasts.show({ message: 'Fun facts muted. Turn them back on in the Fun facts page.' });
          },
        },
      });
      factSettings.recordShown(now);
      dueAt.current = nextFactDueAt(now);
    };
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return null;
}
