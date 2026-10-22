/**
 * Shuffle bag for the background music: every track plays once before any
 * repeats, the same artist never plays twice in a row (when avoidable), and
 * neither era runs more than MAX_ERA_RUN tracks in a row (when avoidable).
 * The bag is a plain serializable value so it can survive reloads.
 */
import type { Era } from '../../data/tracks';

export interface BagTrack {
  id: string;
  artist: string;
  era: Era;
}

export interface BagState {
  /** Ids not yet played in this cycle. */
  remaining: string[];
  lastArtist: string | null;
  /** Eras of the most recent picks, newest last (at most MAX_ERA_RUN). */
  recentEras: Era[];
}

export const MAX_ERA_RUN = 2;

export const emptyBag = (): BagState => ({ remaining: [], lastArtist: null, recentEras: [] });

/** Drops ids that no longer exist (a track was removed between versions). */
export function reconcile(state: BagState, tracks: readonly BagTrack[]): BagState {
  const ids = new Set(tracks.map((t) => t.id));
  return { ...state, remaining: state.remaining.filter((id) => ids.has(id)) };
}

function eraBlocked(recent: readonly Era[], era: Era): boolean {
  return recent.length >= MAX_ERA_RUN && recent.slice(-MAX_ERA_RUN).every((e) => e === era);
}

/**
 * Chooses an artist weighted by how many of their tracks are still in the
 * bag, then one of their candidate tracks. Artists with many tracks get
 * spread through the cycle instead of piling up at its end (which would
 * force back-to-back repeats).
 */
function pickSpread(
  candidates: readonly BagTrack[],
  pool: readonly BagTrack[],
  random: () => number,
): BagTrack {
  const remainingByArtist = new Map<string, number>();
  for (const t of pool) remainingByArtist.set(t.artist, (remainingByArtist.get(t.artist) ?? 0) + 1);
  const artists = [...new Set(candidates.map((t) => t.artist))];
  const weights = artists.map((a) => remainingByArtist.get(a) ?? 1);
  let roll = random() * weights.reduce((sum, w) => sum + w, 0);
  let artist = artists[artists.length - 1]!;
  for (let i = 0; i < artists.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) {
      artist = artists[i]!;
      break;
    }
  }
  const theirs = candidates.filter((t) => t.artist === artist);
  return theirs[Math.min(theirs.length - 1, Math.floor(random() * theirs.length))]!;
}

/**
 * Picks the next track. `random` returns [0, 1). Refills the bag with every
 * track when it's empty; new tracks join at the next refill.
 */
export function nextTrack(
  state: BagState,
  tracks: readonly BagTrack[],
  random: () => number,
): { track: BagTrack; state: BagState } {
  if (tracks.length === 0) throw new Error('No tracks');
  const byId = new Map(tracks.map((t) => [t.id, t]));
  let remaining = reconcile(state, tracks).remaining;
  if (remaining.length === 0) remaining = tracks.map((t) => t.id);
  const pool = remaining.map((id) => byId.get(id)!);

  // An artist holding half or more of what's left must play now (unless they
  // just did), or their tracks would end up back to back at the cycle's end.
  const counts = new Map<string, number>();
  for (const t of pool) counts.set(t.artist, (counts.get(t.artist) ?? 0) + 1);
  const [dominant, most] = [...counts].sort((a, b) => b[1] - a[1])[0]!;
  const forced = most * 2 >= pool.length && dominant !== state.lastArtist && counts.size > 1;

  // Preferences, strongest first; fall back when nothing satisfies them.
  const candidates =
    [
      forced ? pool.filter((t) => t.artist === dominant) : [],
      pool.filter((t) => t.artist !== state.lastArtist && !eraBlocked(state.recentEras, t.era)),
      pool.filter((t) => t.artist !== state.lastArtist),
      pool,
    ].find((list) => list.length > 0) ?? pool;

  const track = pickSpread(candidates, pool, random);
  return {
    track,
    state: {
      remaining: remaining.filter((id) => id !== track.id),
      lastArtist: track.artist,
      recentEras: [...state.recentEras, track.era].slice(-MAX_ERA_RUN),
    },
  };
}
