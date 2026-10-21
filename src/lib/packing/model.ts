import type { TravelerId } from '../../data/trip';

export const CATEGORIES = ['clothing', 'essentials', 'electronics', 'ski'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  clothing: 'Regular clothing',
  essentials: 'Essentials',
  electronics: 'Electronics',
  ski: 'Ski gear',
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  clothing: '👕',
  essentials: '🧴',
  electronics: '🔌',
  ski: '🎿',
};

export const OWNERSHIPS = ['need-to-buy', 'have'] as const;
export type Ownership = (typeof OWNERSHIPS)[number];

export const OWNERSHIP_LABEL: Record<Ownership, string> = {
  'need-to-buy': 'Need to buy',
  have: 'Already have',
};

export interface PackingItem {
  id: string;
  name: string;
  category: Category;
  ownership: Ownership;
  packed: boolean;
  createdAt: number;
}

export const STATE_VERSION = 1;

export interface PackingState {
  version: typeof STATE_VERSION;
  lists: Record<TravelerId, PackingItem[]>;
  /** Whether each traveler has accepted or skipped the starter template. */
  templateDecided: Record<TravelerId, boolean>;
}

export const MAX_ITEM_NAME_LENGTH = 80;
export const MAX_ITEMS_PER_LIST = 300;

export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_NAME_LENGTH);
}

export function createEmptyState(travelers: readonly TravelerId[]): PackingState {
  const lists = {} as Record<TravelerId, PackingItem[]>;
  const templateDecided = {} as Record<TravelerId, boolean>;
  for (const id of travelers) {
    lists[id] = [];
    templateDecided[id] = false;
  }
  return { version: STATE_VERSION, lists, templateDecided };
}

export type IdGenerator = () => string;

export const defaultIdGenerator: IdGenerator = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
