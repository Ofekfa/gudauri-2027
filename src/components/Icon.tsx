import type { SVGAttributes } from 'preact';

/** Simple stroke icons (24×24). Decorative by default; pass `label` to expose to AT. */
const PATHS = {
  home: 'M3 11 12 3l9 8M5 9.5V21h5v-6h4v6h5V9.5',
  plane:
    'M10.5 21 12 17l-1-6-7 2.5V11l7-4.5V3.5a1.5 1.5 0 0 1 3 0v3l7 4.5v2.5L14 11l-1 6 1.5 4h-4Z',
  backpack:
    'M8 6V5a4 4 0 0 1 8 0v1M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8Zm3 6h6v4H9z',
  game: 'M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4Zm2 2v4m-2-2h4m5-.5h.01m2 1.5h.01',
  more: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
  bulb: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
  chat: 'M4 5h16v11H9l-5 4V5Zm4 5h.01m4 0h.01m4 0h.01',
  arrowLeft: 'M19 12H5m6-6-6 6 6 6',
  bag: 'M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M4 7h16v13H4zm5 4v5m6-5v5',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
  upload: 'M12 20V9m-5 5 5-5 5 5M5 4h14',
  cart: 'M3 4h2l2.4 11h10.2L20 8H7M9 20h.01M17 20h.01',
  plus: 'M12 5v14M5 12h14',
  coins:
    'M20 7c0 1.66-3.58 3-8 3S4 8.66 4 7s3.58-3 8-3 8 1.34 8 3ZM4 7v5c0 1.66 3.58 3 8 3s8-1.34 8-3V7M4 12v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5',
  checklist: 'M10 6h10M10 12h10M10 18h10M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17',
  users:
    'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1a4 4 0 0 0-3-3.87M15.5 4.13a3.5 3.5 0 0 1 0 6.74',
  snowflake:
    'M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18M9 4l3 2 3-2M9 20l3-2 3 2M3 10l3 2-3 2m18-4-3 2 3 2',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'label'> {
  name: IconName;
  label?: string;
  size?: number;
}

const DEFAULT_SIZE = 24;

export function Icon({ name, label, size = DEFAULT_SIZE, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
