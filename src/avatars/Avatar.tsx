import { useId } from 'preact/hooks';
import { CHARACTERS } from '../data/characters';
import { trip, type TravelerId } from '../data/trip';
import { FaceArt } from './FaceArt';

const STICKER_RADIUS = 56;
const POLE = '#4a5568';
const PANTS = '#25344d';
const BOOTS = '#1b2230';
const SKI = '#e8f1fa';
const SKI_EDGE = '#1b2230';
/** Skis angled into a beginner-friendly "pizza" wedge, tips toward the viewer. */
const SKI_WEDGE_DEG = 14;
/** Skier head: the shared face scaled down and centered at (60, HEAD_CENTER_Y). */
const HEAD_SCALE = 0.62;
const HEAD_CENTER_Y = 33;
const FACE_CENTER = { x: 60, y: 62 };

interface AvatarProps {
  id: TravelerId;
  size?: number;
  /** Hide from assistive tech when a visible name sits next to it. */
  decorative?: boolean;
  class?: string;
}

function nameOf(id: TravelerId): string {
  return trip.travelers.find((t) => t.id === id)?.name ?? id;
}

function a11yProps(label: string, decorative: boolean) {
  return decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': label };
}

/** Round "sticker" portrait used for profiles and lists. */
export function AvatarFace({ id, size = 64, decorative = false, class: className }: AvatarProps) {
  const look = CHARACTERS[id];
  const clipId = useId();
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      class={className}
      focusable="false"
      {...a11yProps(nameOf(id), decorative)}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={60} cy={60} r={STICKER_RADIUS} />
        </clipPath>
      </defs>
      <circle cx={60} cy={60} r={STICKER_RADIUS} fill={look.jacket} opacity={0.18} />
      <g clip-path={`url(#${clipId})`}>
        <FaceArt look={look} />
      </g>
      <circle cx={60} cy={60} r={STICKER_RADIUS} fill="none" stroke="#ffffff" stroke-width={4} />
      <circle
        cx={60}
        cy={60}
        r={STICKER_RADIUS + 2.5}
        fill="none"
        stroke="rgb(14 42 71 / 18%)"
        stroke-width={1}
      />
    </svg>
  );
}

/** Full-body skiing pose, facing the viewer (skiing down the screen). Used by the game. */
export function AvatarSkier({ id, size = 96, decorative = false, class: className }: AvatarProps) {
  const look = CHARACTERS[id];
  return (
    <svg
      viewBox="0 0 120 150"
      width={size}
      height={(size * 150) / 120}
      class={className}
      focusable="false"
      {...a11yProps(`${nameOf(id)} skiing`, decorative)}
    >
      <ellipse cx={60} cy={146} rx={34} ry={4} fill="#0e2a47" opacity={0.15} />
      {/* Poles */}
      <path
        d="M27 88L16 138M93 88L104 138"
        stroke={POLE}
        stroke-width={2.5}
        stroke-linecap="round"
      />
      <path d="M11 137h10M99 137h10" stroke={POLE} stroke-width={2.5} stroke-linecap="round" />
      {/* Skis */}
      {[
        { x: 39, angle: -SKI_WEDGE_DEG },
        { x: 70, angle: SKI_WEDGE_DEG },
      ].map(({ x, angle }) => (
        <g key={x} transform={`rotate(${angle} ${x + 5.5} 112)`}>
          <rect
            x={x}
            y={106}
            width={11}
            height={40}
            rx={5.5}
            fill={SKI}
            stroke={SKI_EDGE}
            stroke-width={2}
          />
          <path
            d={`M${x + 5.5} 120v20`}
            stroke={look.jacket}
            stroke-width={3}
            stroke-linecap="round"
          />
        </g>
      ))}
      {/* Legs and boots */}
      <path d="M45 96L41 114H53L57 98Z M75 96L79 114H67L63 98Z" fill={PANTS} />
      <rect x={39} y={110} width={15} height={9} rx={3} fill={BOOTS} />
      <rect x={66} y={110} width={15} height={9} rx={3} fill={BOOTS} />
      {/* Torso */}
      <path
        d="M38 66C38 58 48 54 60 54C72 54 82 58 82 66L84 100C76 104 44 104 36 100Z"
        fill={look.jacket}
      />
      <path d="M60 58V100" stroke={look.jacketShade} stroke-width={2} />
      <path d="M36 92C46 96 74 96 84 92" stroke={look.jacketShade} stroke-width={3} fill="none" />
      {/* Arms and gloves */}
      <path
        d="M41 64C33 70 29 80 27 88M79 64C87 70 91 80 93 88"
        stroke={look.jacket}
        stroke-width={9}
        stroke-linecap="round"
        fill="none"
      />
      <circle cx={27} cy={89} r={5} fill={BOOTS} />
      <circle cx={93} cy={89} r={5} fill={BOOTS} />
      {/* Head */}
      <g
        transform={`translate(${FACE_CENTER.x * (1 - HEAD_SCALE)} ${HEAD_CENTER_Y - FACE_CENTER.y * HEAD_SCALE}) scale(${HEAD_SCALE})`}
      >
        <FaceArt look={look} shoulders={false} goggles />
      </g>
    </svg>
  );
}
