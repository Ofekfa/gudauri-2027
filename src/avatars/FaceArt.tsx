import type { CharacterLook, HairStyle } from '../data/characters';

/**
 * The shared head drawing, in a 120×120 coordinate space with the face centered
 * at (60, 62). Every avatar uses the same face geometry so the four characters
 * read as one family; only the traits in CharacterLook change.
 */

const MOUTH = '#8c3a2e';
const BLUSH = '#f29b9b';
const PUPIL = '#1b1b1b';
const FRECKLE = '#c2683d';

const FACE = 'M34 60C34 40 46 32 60 32C74 32 86 40 86 60C86 78 75 92 60 92C45 92 34 78 34 60Z';

/** Hair drawn behind the head (long hair, bun). */
const HAIR_BACK: Partial<Record<HairStyle, string>> = {
  long: 'M30 62C26 36 42 22 60 22C78 22 94 36 90 62C92 80 94 96 98 108C86 112 78 106 76 98L44 98C42 106 34 112 22 108C26 96 28 80 30 62Z',
  wavy: 'M30 62C26 36 42 22 60 22C78 22 94 36 90 62C94 72 90 80 95 88C99 96 94 104 98 110C88 114 80 108 78 100L42 100C40 108 32 114 22 110C26 104 21 96 25 88C30 80 26 72 30 62Z',
};

/** Hair drawn over the head (fringe, cap, framing strands). */
const HAIR_FRONT: Record<HairStyle, string[]> = {
  short: [
    'M33 61C30 38 44 25 61 25C79 25 91 38 87 61C86 53 84 47 80 43C75 39 67 38 61 40C55 42 47 41 41 45C37 49 35 54 33 61Z',
  ],
  long: [
    'M33 64C30 38 44 26 62 26C80 26 90 40 87 64C84 52 78 44 70 42C60 46 46 46 38 52C35 56 34 60 33 64Z',
    'M33 60C32 72 33 84 36 94L40 94C37 82 36 70 37 58Z',
    'M87 60C88 72 87 84 84 94L80 94C83 82 84 70 83 58Z',
  ],
  bun: [
    'M33 62C31 40 44 28 60 28C76 28 89 40 87 62C85 52 80 44 72 40C66 38 54 38 48 40C40 44 35 52 33 62Z',
  ],
  wavy: [
    'M33 64C30 38 44 26 60 26C76 26 90 38 87 64C84 54 78 46 66 42C64 40 61 38 60 36C59 38 56 40 54 42C42 46 36 54 33 64Z',
    'M33 60C31 70 34 78 32 86C34 90 37 92 40 94C38 86 40 78 37 70C36 66 36 62 37 58Z',
    'M87 60C89 70 86 78 88 86C86 90 83 92 80 94C82 86 80 78 83 70C84 66 84 62 83 58Z',
  ],
};

const FRECKLES: [number, number][] = [
  [53, 71],
  [56, 73.5],
  [51, 74.5],
  [67, 71],
  [64, 73.5],
  [69, 74.5],
];

interface FaceArtProps {
  look: CharacterLook;
  /** Draw neck and jacket shoulders (portrait); the skier draws its own body. */
  shoulders?: boolean;
  /** Ski goggles pushed up on the forehead. */
  goggles?: boolean;
}

function Eye({ cx, look, side }: { cx: number; look: CharacterLook; side: -1 | 1 }) {
  const cy = 64;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={5} ry={5.6} fill="#ffffff" />
      <circle cx={cx} cy={cy + 0.4} r={3.7} fill={look.eyes} />
      <circle cx={cx} cy={cy + 0.4} r={1.9} fill={PUPIL} />
      <circle cx={cx + 1.3} cy={cy - 1.1} r={1.1} fill="#ffffff" />
      {look.lashes && (
        <path
          d={`M${cx + side * 4.4} ${cy - 3.2}l${side * 1.9} -1.3`}
          stroke={PUPIL}
          stroke-width={1.3}
          stroke-linecap="round"
        />
      )}
    </g>
  );
}

export function FaceArt({ look, shoulders = true, goggles = false }: FaceArtProps) {
  const back = HAIR_BACK[look.hairStyle];
  return (
    <g>
      {shoulders && (
        <>
          <path d="M18 122C20 104 38 96 60 96C82 96 100 104 102 122Z" fill={look.jacket} />
          <path
            d="M48 97L60 108L72 97"
            fill="none"
            stroke={look.jacketShade}
            stroke-width={3}
            stroke-linejoin="round"
          />
        </>
      )}
      {back && <path d={back} fill={look.hair} />}
      {look.hairStyle === 'bun' && (
        <>
          <circle cx={60} cy={21} r={10} fill={look.hair} />
          <path d="M53 18Q60 14 67 18" fill="none" stroke={look.hairShade} stroke-width={1.5} />
          <rect x={53} y={28} width={14} height={4} rx={2} fill={look.jacket} />
        </>
      )}
      <rect x={52} y={84} width={16} height={14} rx={4} fill={look.skinShade} />
      {!back && (
        // Long hair covers the ears.
        <>
          <circle cx={34} cy={64} r={5} fill={look.skin} />
          <circle cx={86} cy={64} r={5} fill={look.skin} />
          <circle cx={34} cy={64} r={2.2} fill={look.skinShade} />
          <circle cx={86} cy={64} r={2.2} fill={look.skinShade} />
        </>
      )}
      <path d={FACE} fill={look.skin} />

      <ellipse cx={44} cy={74} rx={4.5} ry={3} fill={BLUSH} opacity={0.45} />
      <ellipse cx={76} cy={74} rx={4.5} ry={3} fill={BLUSH} opacity={0.45} />
      {look.freckles &&
        FRECKLES.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={0.85} fill={FRECKLE} opacity={0.75} />
        ))}

      <Eye cx={49} look={look} side={-1} />
      <Eye cx={71} look={look} side={1} />
      <path
        d="M43 55.5Q49 52.5 55 55.5M65 55.5Q71 52.5 77 55.5"
        fill="none"
        stroke={look.hairShade}
        stroke-width={2.4}
        stroke-linecap="round"
      />
      <path
        d="M60 66Q57.5 72 61 73"
        fill="none"
        stroke={look.skinShade}
        stroke-width={1.8}
        stroke-linecap="round"
      />
      <path d="M51 78Q60 88 69 78Q60 81 51 78Z" fill={MOUTH} />

      {HAIR_FRONT[look.hairStyle].map((d) => (
        <path key={d} d={d} fill={look.hair} />
      ))}
      {look.hairStyle === 'bun' && (
        <path
          d="M46 36Q60 31 74 36M50 40Q60 36 70 40"
          fill="none"
          stroke={look.hairShade}
          stroke-width={1.2}
          stroke-linecap="round"
          opacity={0.6}
        />
      )}

      {goggles && (
        <g>
          <path
            d="M32 46C44 39 76 39 88 46"
            fill="none"
            stroke="#2b2b2b"
            stroke-width={4}
            stroke-linecap="round"
          />
          <rect
            x={43}
            y={35}
            width={34}
            height={12}
            rx={6}
            fill="#ffb703"
            stroke="#2b2b2b"
            stroke-width={2}
          />
          <path d="M47 39h8" stroke="#fff6d6" stroke-width={2} stroke-linecap="round" />
        </g>
      )}
    </g>
  );
}
