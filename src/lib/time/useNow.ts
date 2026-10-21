import { useEffect, useState } from 'preact/hooks';
import { MS_PER_SECOND } from './countdown';

/** Current time, re-rendering on each wall-clock second boundary. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      timer = setTimeout(tick, MS_PER_SECOND - (current % MS_PER_SECOND));
    };
    timer = setTimeout(tick, MS_PER_SECOND - (Date.now() % MS_PER_SECOND));
    return () => clearTimeout(timer);
  }, []);
  return now;
}
