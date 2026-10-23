/**
 * The shared high scores on this phone: one synced repository for the app,
 * re-synced when the connection comes back or the phone gets an album token.
 */
import { trip } from '../data/trip';
import { clearAlbumToken, getAlbumToken, onAlbumToken } from '../lib/album/token';
import { appStore } from '../lib/storage/safeStorage';
import { toasts } from '../lib/toast/toastStore';
import { WORKER_URL } from '../lib/worker/config';
import { createSyncedHighScores, type SyncResult } from './highScores';

const listeners = new Set<(result: SyncResult) => void>();

function announce(result: SyncResult) {
  for (const runId of result.newBest) {
    const character = trip.travelers.find((t) =>
      result.table[t.id]?.some((e) => e.runId === runId),
    );
    if (character) toasts.show({ emoji: '🏆', message: `New record for ${character.name}!` });
  }
  listeners.forEach((l) => l(result));
}

export const gameScores = createSyncedHighScores({
  store: appStore,
  url: WORKER_URL,
  getToken: () => getAlbumToken(),
  clearToken: () => clearAlbumToken(),
  onResult: announce,
});

export function onScoreSync(listener: (result: SyncResult) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

let started = false;
/** Listens for "back online" and "joined" once, then syncs. */
export function startScoreSync(): Promise<SyncResult> {
  if (!started) {
    started = true;
    window.addEventListener('online', () => void gameScores.sync());
    onAlbumToken(() => void gameScores.sync());
  }
  return gameScores.sync();
}
