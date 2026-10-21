import type { IconName } from './components/Icon';

/** Route metadata only (no components) so nav UI can import it without cycles. */
export interface NavItem {
  path: string;
  /** Page <h1> and document title. */
  title: string;
  /** Short label for nav items. */
  navLabel: string;
  icon: IconName;
  /** One-liner shown on section cards. */
  blurb: string;
  /** Shown directly in the mobile bottom tab bar; the rest live under "More". */
  inTabBar: boolean;
  /** Not built yet — shows a friendly placeholder. */
  comingSoon?: boolean;
}

export const HOME: NavItem = {
  path: '/',
  title: 'Countdown',
  navLabel: 'Home',
  icon: 'home',
  blurb: 'Time left until takeoff.',
  inTabBar: true,
};

export const SECTIONS: NavItem[] = [
  {
    path: '/flights',
    title: 'Flights',
    navLabel: 'Flights',
    icon: 'plane',
    blurb: 'Flight times, airports and baggage.',
    inTabBar: true,
  },
  {
    path: '/packing',
    title: 'Packing lists',
    navLabel: 'Packing',
    icon: 'backpack',
    blurb: 'Everyone’s personal packing checklist.',
    inTabBar: true,
  },
  {
    path: '/game',
    title: 'Ski game',
    navLabel: 'Game',
    icon: 'game',
    blurb: 'Dodge trees, grab khachapuri.',
    inTabBar: true,
    comingSoon: true,
  },
  {
    path: '/facts',
    title: 'Fun facts',
    navLabel: 'Facts',
    icon: 'bulb',
    blurb: 'Skiing, Gudauri, Georgia and food.',
    inTabBar: false,
  },
  {
    path: '/map',
    title: 'Ski map',
    navLabel: 'Map',
    icon: 'map',
    blurb: 'Runs and lifts of Gudauri.',
    inTabBar: false,
  },
  {
    path: '/assistant',
    title: 'Trip assistant',
    navLabel: 'Assistant',
    icon: 'chat',
    blurb: 'Ask anything about skiing or our trip.',
    inTabBar: false,
    comingSoon: true,
  },
];

export const MORE: NavItem = {
  path: '/more',
  title: 'More',
  navLabel: 'More',
  icon: 'more',
  blurb: 'All other sections.',
  inTabBar: true,
};

export const ALL_ITEMS: NavItem[] = [HOME, ...SECTIONS, MORE];

export const TAB_BAR_ITEMS: NavItem[] = [HOME, ...SECTIONS.filter((s) => s.inTabBar), MORE];

export const MORE_ITEMS: NavItem[] = SECTIONS.filter((s) => !s.inTabBar);

export function findNavItem(path: string): NavItem | undefined {
  return ALL_ITEMS.find((item) => item.path === path);
}

/** Which tab is highlighted: sections that live under "More" light up the More tab. */
export function activeTabPath(path: string): string {
  return MORE_ITEMS.some((item) => item.path === path) ? MORE.path : path;
}
