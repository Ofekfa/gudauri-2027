import { useEffect, useState } from 'preact/hooks';
import type { PisteMap } from '../../lib/map/types';
import { PisteMapSvg } from './PisteMapSvg';

/** Frames the main resort area (map units) rather than the whole Kobi valley. */
const BACKGROUND_VIEWBOX = '330 700 620 1000';

/** Decorative, blurred ski map behind every page. Loaded after first paint. */
export function MapBackground() {
  const [data, setData] = useState<PisteMap | null>(null);
  useEffect(() => {
    let cancelled = false;
    import('../../data/pistes.json')
      .then((m) => !cancelled && setData(m.default as PisteMap))
      .catch(() => {
        /* Purely decorative: the sky gradient stays if this fails. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div class="backdrop" aria-hidden="true">
      {data && (
        <PisteMapSvg
          data={data}
          viewBox={BACKGROUND_VIEWBOX}
          preserveAspectRatio="xMidYMid slice"
          class="backdrop__map"
        />
      )}
      <div class="backdrop__veil" />
    </div>
  );
}
