import type { Ref } from 'preact';
import { useId, useMemo } from 'preact/hooks';
import { groupRuns, liftKey, LIFT_LABEL } from '../../lib/map/catalog';
import type { MapPoi, PisteMap } from '../../lib/map/types';

/**
 * Original stylized illustration of Gudauri drawn from OpenStreetMap data.
 * Colors come from CSS (.piste-map …) so light/dark themes work.
 */

/** Half-width and height (map units) of the decorative ridge drawn under each peak. */
const RIDGE_HALF_WIDTH = 140;
const RIDGE_HEIGHT = 230;
/** Decorative pines along the village at the bottom of the map (x, y in map units). */
const PINES: [number, number][] = [
  [380, 1700],
  [410, 1730],
  [450, 1712],
  [700, 1690],
  [735, 1722],
  [770, 1700],
  [300, 1760],
  [860, 1745],
];
const PINE_SIZE = 18;
const PEAK_GLYPH = 16;

interface PisteMapSvgProps {
  data: PisteMap;
  /** Show lift, peak and landmark names. */
  labels?: boolean;
  /** Key of the selected run group or lift; others are dimmed. */
  selectedKey?: string | null;
  viewBox?: string;
  preserveAspectRatio?: string;
  svgRef?: Ref<SVGSVGElement>;
  class?: string;
  title?: string;
}

function PoiMarker({ poi, labels }: { poi: MapPoi; labels: boolean }) {
  const { x, y } = poi;
  return (
    <g class={`map-poi map-poi--${poi.kind}`}>
      {poi.kind === 'peak' && (
        <path
          d={`M${x - PEAK_GLYPH} ${y + PEAK_GLYPH * 0.8}L${x} ${y - PEAK_GLYPH * 0.8}L${x + PEAK_GLYPH} ${y + PEAK_GLYPH * 0.8}Z`}
        />
      )}
      {poi.kind === 'hotel' && (
        <>
          <circle cx={x} cy={y} r={20} />
          <path
            d={`M${x - 9} ${y + 8}V${y - 1}L${x} ${y - 9}L${x + 9} ${y - 1}V${y + 8}Z`}
            class="map-poi__icon"
          />
        </>
      )}
      {poi.kind === 'monument' && (
        <>
          <circle cx={x} cy={y} r={16} />
          <path
            d={`M${x} ${y - 9}L${x + 3} ${y - 2}H${x + 9}L${x + 4} ${y + 3}L${x + 6} ${y + 10}L${x} ${y + 5}L${x - 6} ${y + 10}L${x - 4} ${y + 3}L${x - 9} ${y - 2}H${x - 3}Z`}
            class="map-poi__icon"
          />
        </>
      )}
      {labels && (
        <text x={x} y={y + (poi.kind === 'peak' ? 36 : 44)} class="map-label">
          {poi.name}
          {poi.eleM && <tspan class="map-label__sub"> {poi.eleM.toLocaleString('en')} m</tspan>}
        </text>
      )}
    </g>
  );
}

export function PisteMapSvg({
  data,
  labels = false,
  selectedKey = null,
  viewBox = `0 0 ${data.width} ${data.height}`,
  preserveAspectRatio,
  svgRef,
  class: className,
  title,
}: PisteMapSvgProps) {
  const runKeyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groupRuns(data.runs)) for (const id of group.runIds) map.set(id, group.key);
    return map;
  }, [data]);

  const ridgeGradientId = useId();
  const peaks = data.pois.filter((p) => p.kind === 'peak');
  const isSelected = (key: string) => (selectedKey === key ? ' is-selected' : '');

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      class={`piste-map${selectedKey ? ' has-selection' : ''}${className ? ` ${className}` : ''}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={ridgeGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="map-ridge-stop" />
          <stop offset="1" class="map-ridge-stop" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect class="map-snow" x={0} y={0} width={data.width} height={data.height} />
      <g class="map-ridges" fill={`url(#${ridgeGradientId})`}>
        {peaks.map((p) => (
          <path
            key={p.id}
            d={`M${p.x - RIDGE_HALF_WIDTH} ${p.y + RIDGE_HEIGHT}L${p.x} ${p.y}L${p.x + RIDGE_HALF_WIDTH} ${p.y + RIDGE_HEIGHT}Z`}
          />
        ))}
      </g>
      <g class="map-pines">
        {PINES.map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x} ${y - PINE_SIZE}L${x + PINE_SIZE * 0.6} ${y + PINE_SIZE * 0.6}H${x - PINE_SIZE * 0.6}Z`}
          />
        ))}
      </g>

      <g class="map-runs">
        {data.runs.map((run) =>
          run.area ? (
            <path
              key={run.id}
              d={run.path}
              data-key={runKeyById.get(run.id)}
              class={`map-run-area map-run--${run.difficulty}${isSelected(runKeyById.get(run.id) ?? '')}`}
            />
          ) : (
            <g
              key={run.id}
              data-key={runKeyById.get(run.id)}
              class={`map-run map-run--${run.difficulty}${isSelected(runKeyById.get(run.id) ?? '')}`}
            >
              <path d={run.path} class="map-run__casing" />
              <path d={run.path} class="map-run__line" />
              <path d={run.path} class="map-hit" />
            </g>
          ),
        )}
      </g>

      <g class="map-lifts">
        {data.lifts.map((lift) => (
          <g key={lift.id} data-key={liftKey(lift)} class={`map-lift${isSelected(liftKey(lift))}`}>
            <path d={lift.path} class="map-lift__line" />
            {lift.stations.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={5} class="map-lift__station" />
            ))}
            <path d={lift.path} class="map-hit" />
          </g>
        ))}
      </g>

      {labels && (
        <g class="map-lift-labels">
          {data.lifts
            .filter((l) => l.name && l.lengthM > 200)
            .map((lift) => {
              const [[x1, y1], [x2, y2]] = lift.stations;
              return (
                <text
                  key={lift.id}
                  x={(x1 + x2) / 2 + 12}
                  y={(y1 + y2) / 2}
                  class="map-label map-label--lift"
                >
                  {lift.name}
                  <title>{`${lift.name} (${LIFT_LABEL[lift.kind]})`}</title>
                </text>
              );
            })}
        </g>
      )}

      <g class="map-pois">
        {data.pois.map((poi) => (
          <PoiMarker key={poi.id} poi={poi} labels={labels} />
        ))}
      </g>
    </svg>
  );
}
