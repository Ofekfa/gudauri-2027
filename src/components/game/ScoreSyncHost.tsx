import { useEffect } from 'preact/hooks';
import { appStore } from '../../lib/storage/safeStorage';

/** Same key as highScores.PENDING_KEY; duplicated so the shell doesn't load the game. */
const PENDING_KEY = 'game:pendingScores';

/** Sends runs left unsent on an earlier visit, without loading game code otherwise. */
export function ScoreSyncHost() {
  useEffect(() => {
    const raw = appStore.get(PENDING_KEY);
    // Cheap check: some run is waiting and not refused.
    if (raw && /"runId"/.test(raw) && /"items":\[\{/.test(raw))
      void import('../../game/scoreSync').then((m) => m.startScoreSync());
  }, []);
  return null;
}
