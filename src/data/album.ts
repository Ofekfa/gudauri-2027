/**
 * The album's frames: one per moment of the trip, in story order. Order and
 * text live here so frames can be reordered or added without code changes.
 * Dinners are derived from the trip's dates. Emoji are generic (no logos).
 */
import { trip } from './trip';

export interface AlbumFrame {
  /** URL slug: #/album/<id>. */
  id: string;
  title: string;
  /** A playful one-liner shown on the empty frame. */
  prompt: string;
  emoji: string;
  /** YYYY-MM-DD (Tbilisi) when the moment is expected, if known. */
  dateHint?: string;
  /** Extra frames after the story; not counted in progress. */
  bonus?: boolean;
  /** Added by us on the site (stored by the Worker), not predefined here. */
  custom?: true;
}

export const MAX_PHOTOS_PER_FRAME = 30;
export const MAX_CAPTION_CHARS = 120;

const DAY_MS = 86_400_000;
const shift = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const dayName = (day: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(Date.parse(`${day}T00:00:00Z`));

const DINNER_PROMPTS = [
  'First night in the mountains: what did we order?',
  'Best khachapuri of the trip?',
  'Who ate the most khinkali?',
  'Toast to the tamada!',
  'Farewell feast before the airport',
];

/** One dinner per evening in Georgia, first to last day. */
export function dinnerFrames(firstDay: string, lastDay: string): AlbumFrame[] {
  const frames: AlbumFrame[] = [];
  for (let day = firstDay, i = 0; day <= lastDay; day = shift(day, 1), i++) {
    frames.push({
      id: `dinner-${day}`,
      title: `Dinner — ${dayName(day)}`,
      prompt: DINNER_PROMPTS[i % DINNER_PROMPTS.length]!,
      emoji: '🍽️',
      dateHint: day,
    });
  }
  return frames;
}

export const ALBUM_FRAMES: AlbumFrame[] = [
  {
    id: 'mcdonalds',
    title: 'McDonald’s before the flight',
    prompt: 'Fries at 3 a.m.? No judgement.',
    emoji: '🍟',
    dateHint: trip.firstDay,
  },
  {
    id: 'flight-out',
    title: `The flight (${trip.outbound.flightNo})`,
    prompt: 'Window seat selfie, anyone?',
    emoji: '✈️',
    dateHint: trip.firstDay,
  },
  {
    id: 'taxi',
    title: 'Taxi to the ski resort',
    prompt: 'The Military Road, bends and all',
    emoji: '🚕',
    dateHint: trip.firstDay,
  },
  { id: 'first-snow', title: 'First snow', prompt: 'The very first snowflake moment', emoji: '❄️' },
  { id: 'snowman', title: 'Snowman', prompt: 'Give it a name!', emoji: '⛄' },
  { id: 'snowball-fight', title: 'Snowball fight', prompt: 'Who threw first?', emoji: '🌨️' },
  { id: 'skiing', title: 'Skiing', prompt: 'Action shots, wipeouts welcome', emoji: '⛷️' },
  { id: 'gondola', title: 'Gondola', prompt: 'Views from the cabin', emoji: '🚡' },
  ...dinnerFrames(trip.firstDay, trip.lastDay),
  { id: 'lunch-beer', title: 'Lunch beer', prompt: 'Cheers between runs', emoji: '🍺' },
  { id: 'bowling', title: 'Bowling', prompt: 'Strike or gutter?', emoji: '🎳' },
  { id: 'snooker', title: 'Snooker', prompt: 'Who potted the black?', emoji: '🎱' },
  { id: 'pool', title: 'Pool', prompt: 'Warm water, cold mountains', emoji: '🏊' },
  { id: 'bar', title: 'Bar', prompt: 'Last round?', emoji: '🍸' },
  {
    id: 'flight-home',
    title: `The flight home (${trip.inbound.flightNo})`,
    prompt: 'Already planning the next trip',
    emoji: '🛬',
    dateHint: trip.lastDay,
  },
  {
    id: 'the-four-of-us',
    title: 'The four of us',
    prompt: 'Squeeze in!',
    emoji: '🤳',
    bonus: true,
  },
  {
    id: 'best-view',
    title: 'Best view',
    prompt: 'The one for the wallpaper',
    emoji: '🏔️',
    bonus: true,
  },
  {
    id: 'funniest-moment',
    title: 'Funniest moment',
    prompt: 'You had to be there',
    emoji: '😂',
    bonus: true,
  },
];

export const PLANNED_FRAMES = ALBUM_FRAMES.filter((f) => !f.bonus);
export const findFrame = (id: string) => ALBUM_FRAMES.find((f) => f.id === id);
