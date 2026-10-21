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

/** Sections are grouped on the More page. */
export const NAV_GROUPS = ['plan', 'tools', 'fun'] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export const GROUP_LABEL: Record<NavGroup, string> = {
  plan: 'Plan',
  tools: 'Tools',
  fun: 'Fun',
};

export interface SectionItem extends NavItem {
  group: NavGroup;
}

export const HOME: NavItem = {
  path: '/',
  title: 'Countdown',
  navLabel: 'Home',
  icon: 'home',
  blurb: 'Time left until takeoff.',
  inTabBar: true,
};

export const SECTIONS: SectionItem[] = [
  {
    path: '/flights',
    group: 'plan',
    title: 'Flights',
    navLabel: 'Flights',
    icon: 'plane',
    blurb: 'Flight times, airports and baggage.',
    inTabBar: true,
  },
  {
    path: '/packing',
    group: 'plan',
    title: 'Packing lists',
    navLabel: 'Packing',
    icon: 'backpack',
    blurb: 'Everyone’s personal packing checklist.',
    inTabBar: true,
  },
  {
    path: '/game',
    group: 'fun',
    title: 'Ski game',
    navLabel: 'Game',
    icon: 'game',
    blurb: 'Dodge trees, grab khachapuri.',
    inTabBar: true,
  },
  {
    path: '/facts',
    group: 'fun',
    title: 'Fun facts',
    navLabel: 'Facts',
    icon: 'bulb',
    blurb: 'Skiing, Gudauri, Georgia and food.',
    inTabBar: false,
  },
  {
    path: '/map',
    group: 'tools',
    title: 'Ski map',
    navLabel: 'Map',
    icon: 'map',
    blurb: 'Runs and lifts of Gudauri.',
    inTabBar: false,
  },
  {
    path: '/assistant',
    group: 'tools',
    title: 'Trip assistant',
    navLabel: 'Assistant',
    icon: 'chat',
    blurb: 'Ask anything about skiing or our trip.',
    inTabBar: false,
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

/** Primary navigation: the mobile tab bar and the desktop header show the same five items. */
export const TAB_BAR_ITEMS: NavItem[] = [HOME, ...SECTIONS.filter((s) => s.inTabBar), MORE];

export const MORE_ITEMS: SectionItem[] = SECTIONS.filter((s) => !s.inTabBar);

/** More-page sections in group order, skipping empty groups. */
export const MORE_GROUPS: { group: NavGroup; label: string; items: SectionItem[] }[] =
  NAV_GROUPS.map((group) => ({
    group,
    label: GROUP_LABEL[group],
    items: MORE_ITEMS.filter((item) => item.group === group),
  })).filter((g) => g.items.length > 0);

export function findNavItem(path: string): NavItem | undefined {
  return ALL_ITEMS.find((item) => item.path === path);
}

/** Which tab is highlighted: sections that live under "More" light up the More tab. */
export function activeTabPath(path: string): string {
  return MORE_ITEMS.some((item) => item.path === path) ? MORE.path : path;
}
