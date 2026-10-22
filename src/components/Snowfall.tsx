/**
 * Gentle decorative snowfall behind everything. Pure CSS animation (transform
 * only, on the compositor); off for reduced motion and paused in hidden tabs.
 */
import { useEffect, useState } from 'preact/hooks';
import { flakeCount, makeFlakes } from '../lib/snowfall/flakes';

export function Snowfall() {
  // Sized once for the viewport it first appears in.
  const [flakes] = useState(() => makeFlakes(flakeCount(window.innerWidth, window.innerHeight)));
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div class={`snowfall${hidden ? ' snowfall--paused' : ''}`} aria-hidden="true">
      {flakes.map((f, i) => (
        <span
          key={i}
          style={{
            left: `${f.left}%`,
            width: `${f.sizePx}px`,
            height: `${f.sizePx}px`,
            opacity: f.opacity,
            animationDuration: `${f.durationS}s`,
            animationDelay: `${f.delayS}s`,
            '--drift': `${f.driftPx}px`,
          }}
        />
      ))}
    </div>
  );
}
