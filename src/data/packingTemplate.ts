import type { NewItem } from '../lib/packing/reducer';

/** Optional starter list offered once per traveler. Everything starts as "already have". */
const item = (name: string, category: NewItem['category']): NewItem => ({
  name,
  category,
  ownership: 'have',
});

export const PACKING_TEMPLATE: NewItem[] = [
  // Ski gear
  item('Ski jacket', 'ski'),
  item('Ski pants', 'ski'),
  item('Thermal base layer (top)', 'ski'),
  item('Thermal base layer (bottom)', 'ski'),
  item('Mid layer / fleece', 'ski'),
  item('Ski socks (x3)', 'ski'),
  item('Ski gloves', 'ski'),
  item('Glove liners', 'ski'),
  item('Neck warmer / buff', 'ski'),
  item('Helmet (or rent)', 'ski'),
  item('Ski goggles', 'ski'),
  item('Small backpack for the slopes', 'ski'),
  // Regular clothing
  item('Warm winter coat', 'clothing'),
  item('Sweaters', 'clothing'),
  item('Jeans / trousers', 'clothing'),
  item('T-shirts', 'clothing'),
  item('Underwear', 'clothing'),
  item('Warm socks', 'clothing'),
  item('Pyjamas', 'clothing'),
  item('Winter boots with grip', 'clothing'),
  item('Beanie', 'clothing'),
  item('Swimsuit (spa / pool)', 'clothing'),
  // Essentials
  item('Passport', 'essentials'),
  item('Wallet & cards', 'essentials'),
  item('Some cash (GEL)', 'essentials'),
  item('Travel insurance details', 'essentials'),
  item('High-SPF sunscreen', 'essentials'),
  item('SPF lip balm', 'essentials'),
  item('Sunglasses', 'essentials'),
  item('Moisturiser', 'essentials'),
  item('Toiletries', 'essentials'),
  item('Personal medication', 'essentials'),
  item('Painkillers & plasters', 'essentials'),
  // Electronics
  item('Phone charger', 'electronics'),
  item('Power bank (carry-on only)', 'electronics'),
  item('Universal plug adapter', 'electronics'),
  item('Headphones', 'electronics'),
];
