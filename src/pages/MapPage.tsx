import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PisteMapSvg } from '../components/map/PisteMapSvg';
import { PageHeader } from '../components/PageHeader';
import pistes from '../data/pistes.json';
import {
  DIFFICULTY,
  formatLength,
  groupRuns,
  LIFT_LABEL,
  liftKey,
  type RunGroup,
} from '../lib/map/catalog';
import type { Difficulty, MapLift, PisteMap } from '../lib/map/types';

const data = pistes as PisteMap;
const ZOOM_LEVELS = [1, 1.5, 2, 3];
/** Phones start zoomed in so labels are legible; wide screens see the whole resort. */
const NARROW_SCREEN_QUERY = '(max-width: 40rem)';
const NARROW_ZOOM_INDEX = 2;
/** Map point (units) to center on first view: the main lift system above our hotel. */
const INITIAL_FOCUS = { x: 640, y: 1220 };
const DIFFICULTY_ORDER: Difficulty[] = ['novice', 'easy', 'intermediate', 'advanced', 'unknown'];

type Selection =
  { kind: 'run'; key: string; group: RunGroup } | { kind: 'lift'; key: string; lift: MapLift };

function describe(selection: Selection): { title: string; detail: string } {
  if (selection.kind === 'run') {
    const { group } = selection;
    const info = DIFFICULTY[group.difficulty];
    return {
      title: group.name ?? 'Unnamed run',
      detail: `${info.label} run (${info.colorName}) · about ${formatLength(group.lengthM)}`,
    };
  }
  const { lift } = selection;
  return {
    title: lift.name ?? LIFT_LABEL[lift.kind],
    detail: `${LIFT_LABEL[lift.kind]} · about ${formatLength(lift.lengthM)}`,
  };
}

export default function MapPage() {
  const groups = useMemo(() => groupRuns(data.runs), []);
  const namedGroups = groups.filter((g) => g.name);
  const lifts = useMemo(
    () =>
      data.lifts
        .filter((l) => l.name)
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'en', { numeric: true })),
    [],
  );
  const [zoomIndex, setZoomIndex] = useState(() =>
    window.matchMedia(NARROW_SCREEN_QUERY).matches ? NARROW_ZOOM_INDEX : 0,
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const selectByKey = (key: string | null, scroll: boolean) => {
    if (!key) return setSelection(null);
    const group = groups.find((g) => g.key === key);
    const lift = data.lifts.find((l) => liftKey(l) === key);
    if (group) setSelection({ kind: 'run', key, group });
    else if (lift) setSelection({ kind: 'lift', key, lift });
    if (scroll) requestAnimationFrame(() => scrollToKey(key));
  };

  const scrollToKey = (key: string) => {
    const frame = frameRef.current;
    const svg = svgRef.current;
    const el = svg?.querySelector<SVGGraphicsElement>(`[data-key="${CSS.escape(key)}"]`);
    if (!frame || !svg || !el) return;
    const box = el.getBBox();
    const unitsToPx = svg.clientWidth / data.width;
    frame.scrollTo({
      left: (box.x + box.width / 2) * unitsToPx - frame.clientWidth / 2,
      top: (box.y + box.height / 2) * unitsToPx - frame.clientHeight / 2,
      behavior: 'smooth',
    });
    frame.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  useEffect(() => {
    const frame = frameRef.current;
    const svg = svgRef.current;
    if (!frame || !svg) return;
    const unitsToPx = svg.clientWidth / data.width;
    frame.scrollLeft = INITIAL_FOCUS.x * unitsToPx - frame.clientWidth / 2;
    frame.scrollTop = INITIAL_FOCUS.y * unitsToPx - frame.clientHeight / 2;
  }, []);

  // Pointer/touch picking on the drawing. Keyboard users select from the lists below.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element).closest('[data-key]');
      selectByKey(target?.getAttribute('data-key') ?? null, false);
    };
    svg.addEventListener('click', onClick);
    return () => svg.removeEventListener('click', onClick);
  }, []);

  const zoomTo = (nextIndex: number) => {
    const frame = frameRef.current;
    const clamped = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, nextIndex));
    if (!frame || clamped === zoomIndex) return;
    // Keep the same point centered while zooming.
    const ratio = ZOOM_LEVELS[clamped]! / ZOOM_LEVELS[zoomIndex]!;
    const cx = frame.scrollLeft + frame.clientWidth / 2;
    const cy = frame.scrollTop + frame.clientHeight / 2;
    setZoomIndex(clamped);
    requestAnimationFrame(() => {
      frame.scrollLeft = cx * ratio - frame.clientWidth / 2;
      frame.scrollTop = cy * ratio - frame.clientHeight / 2;
    });
  };

  const zoom = ZOOM_LEVELS[zoomIndex]!;
  const selected = selection ? describe(selection) : null;

  return (
    <>
      <PageHeader
        title="Ski map"
        subtitle="Gudauri’s runs and lifts. Tap a run or lift for details."
      />

      <ul class="map-legend" aria-label="Legend">
        {DIFFICULTY_ORDER.filter((d) => d !== 'unknown').map((d) => (
          <li key={d}>
            <span class={`legend-swatch legend-swatch--${d}`} aria-hidden="true" />
            {DIFFICULTY[d].label}
          </li>
        ))}
        <li>
          <span class="legend-swatch legend-swatch--lift" aria-hidden="true" />
          Lift
        </li>
        <li>
          <span class="legend-swatch legend-swatch--hotel" aria-hidden="true" />
          Our hotel
        </li>
      </ul>

      <div class="map-viewer">
        <div class="map-toolbar" role="group" aria-label="Map zoom">
          <button
            type="button"
            onClick={() => zoomTo(zoomIndex - 1)}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
          >
            −
          </button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => zoomTo(zoomIndex + 1)}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        <div class="map-frame" ref={frameRef}>
          <div style={{ width: `${zoom * 100}%` }}>
            <PisteMapSvg
              data={data}
              labels
              selectedKey={selection?.key ?? null}
              svgRef={svgRef}
              title="Illustrated map of Gudauri’s ski runs and lifts"
            />
          </div>
        </div>
        <div class="map-selection" aria-live="polite">
          {selected ? (
            <>
              <p class="map-selection__title">{selected.title}</p>
              <p class="map-selection__detail">{selected.detail}</p>
              <button type="button" class="link-button" onClick={() => setSelection(null)}>
                Clear selection
              </button>
            </>
          ) : (
            <p class="map-selection__detail">Nothing selected.</p>
          )}
        </div>
      </div>

      <section aria-labelledby="runs-title">
        <h2 id="runs-title" class="section-title">
          Runs
        </h2>
        {DIFFICULTY_ORDER.map((difficulty) => {
          const items = namedGroups.filter((g) => g.difficulty === difficulty);
          if (items.length === 0) return null;
          return (
            <div key={difficulty} class="map-list">
              <h3>
                <span class={`legend-swatch legend-swatch--${difficulty}`} aria-hidden="true" />
                {DIFFICULTY[difficulty].label}
              </h3>
              <ul>
                {items.map((g) => (
                  <li key={g.key}>
                    <button
                      type="button"
                      aria-pressed={selection?.key === g.key}
                      onClick={() => selectByKey(g.key, true)}
                    >
                      {g.name}
                      <span class="map-list__meta">{formatLength(g.lengthM)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="lifts-title">
        <h2 id="lifts-title" class="section-title">
          Lifts
        </h2>
        <div class="map-list">
          <ul>
            {lifts.map((lift) => (
              <li key={lift.id}>
                <button
                  type="button"
                  aria-pressed={selection?.key === liftKey(lift)}
                  onClick={() => selectByKey(liftKey(lift), true)}
                >
                  {lift.name}
                  <span class="map-list__meta">{LIFT_LABEL[lift.kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p class="map-attribution">
        Map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap contributors
        </a>{' '}
        (ODbL), as of {data.fetchedAt}. Runs and lifts can also be explored on{' '}
        <a href="https://openskimap.org" target="_blank" rel="noopener noreferrer">
          OpenSkiMap.org
        </a>
        . This is an original illustration, not the official resort map: it isn’t to scale and may
        be incomplete, so follow the resort’s signs on the mountain.
      </p>
    </>
  );
}
