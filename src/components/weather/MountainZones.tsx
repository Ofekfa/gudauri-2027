import { useId } from 'preact/hooks';
import { ZONES, type ZoneId } from '../../data/zones';
import { describeWeather } from '../../lib/weather/codes';
import { elevationToY, GRAPHIC, snowBlanketPx } from '../../lib/weather/graphic';
import type { ZoneWeather } from '../../lib/weather/types';

/** Original side-profile illustration of the ski area (not to scale horizontally). */
const MOUNTAIN =
  'M0 270 L0 222 L28 205 L52 196 L74 166 L96 150 L118 112 L134 98 L150 70 L164 46 L178 62 L190 56 L204 92 L214 104 L214 270 Z';
const LABEL_X = GRAPHIC.mountainRight + 14;
const HOTEL_X = 46;

interface MountainZonesProps {
  zones: ZoneWeather[];
  selected: ZoneId;
}

export function MountainZones({ zones, selected }: MountainZonesProps) {
  const clipId = useId();
  const titleId = useId();
  const descId = useId();
  const byId = new Map(zones.map((z) => [z.id, z]));
  const summary = ZONES.map((zone) => {
    const w = byId.get(zone.id);
    if (!w) return `${zone.name} (${zone.elevationM} m): no data`;
    const depth =
      w.snowDepthCm === null
        ? 'snow depth unknown'
        : w.snowDepthCm === 0
          ? 'no snow on the ground (estimated)'
          : `about ${w.snowDepthCm} cm of snow (estimated)`;
    return `${zone.name} (${zone.elevationM} m): ${w.current.tempC}°C, ${describeWeather(w.current.code).label.toLowerCase()}, ${depth}`;
  }).join('. ');

  return (
    <svg
      class="mountain"
      viewBox={`0 0 ${GRAPHIC.width} ${GRAPHIC.height}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>Temperature and snow at three altitudes</title>
      <desc id={descId}>{summary}.</desc>
      <defs>
        <clipPath id={clipId}>
          <path d={MOUNTAIN} />
        </clipPath>
      </defs>
      <path d={MOUNTAIN} class="mountain__rock" />
      <g clip-path={`url(#${clipId})`}>
        {ZONES.map((zone) => {
          const w = byId.get(zone.id);
          const y = elevationToY(zone.elevationM);
          const px = snowBlanketPx(w?.snowDepthCm ?? null);
          return px > 0 ? (
            <rect
              key={zone.id}
              class="mountain__snow"
              x={0}
              y={y - px}
              width={GRAPHIC.mountainRight}
              height={px}
            />
          ) : null;
        })}
      </g>
      <path d={MOUNTAIN} class="mountain__outline" />

      {ZONES.map((zone) => {
        const w = byId.get(zone.id);
        const y = elevationToY(zone.elevationM);
        const weather = w ? describeWeather(w.current.code) : null;
        const isSelected = zone.id === selected;
        return (
          <g key={zone.id} class={`mountain__zone${isSelected ? ' is-selected' : ''}`}>
            <line x1={0} x2={LABEL_X - 4} y1={y} y2={y} class="mountain__line" />
            <circle cx={LABEL_X - 4} cy={y} r={3} class="mountain__dot" />
            <text x={LABEL_X} y={y - 4} class="mountain__name">
              {zone.name} · {zone.elevationM.toLocaleString('en')} m
            </text>
            <text x={LABEL_X} y={y + 14} class="mountain__value">
              {w ? `${weather!.emoji} ${Math.round(w.current.tempC)}°` : '—'}
              {w && w.snowDepthCm !== null && (
                <tspan class="mountain__snowlabel"> ❄ {w.snowDepthCm} cm*</tspan>
              )}
            </text>
          </g>
        );
      })}

      {/* Our hotel, in the village zone */}
      <g class="mountain__hotel" transform={`translate(${HOTEL_X} ${elevationToY(2000) - 18})`}>
        <path d="M-8 14 V4 L0 -4 L8 4 V14 Z" />
        <text x={12} y={8} class="mountain__hotel-label">
          Marco Polo
        </text>
      </g>
      <text
        x={GRAPHIC.width - 4}
        y={GRAPHIC.height - 4}
        class="mountain__footnote"
        text-anchor="end"
      >
        * estimated snow depth (model)
      </text>
    </svg>
  );
}
