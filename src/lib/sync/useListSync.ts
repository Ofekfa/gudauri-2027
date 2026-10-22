import { useEffect, useRef, useState } from 'preact/hooks';
import type { TravelerId } from '../../data/trip';
import { WORKER_URL } from '../worker/config';
import type { SyncAdapter } from './adapters';
import { isJoined, syncSettings, type SyncSettings } from './settings';
import { loadChangedBy, syncDoc, type SyncOutcome } from './syncClient';

/** Others' changes show up within this long while the page is open. */
const POLL_MS = 15_000;
/** Wait for a burst of edits (e.g. ticking several items) before sending. */
const DEBOUNCE_MS = 1_500;

export type SyncStatus =
  'off' | 'syncing' | 'synced' | 'offline' | 'wrong-code' | 'not-set-up' | 'error';

export interface ListSyncView {
  status: SyncStatus;
  lastSyncedAt: number | null;
  settings: SyncSettings;
  /** Who last changed each record key ("item/<list>/<id>"). */
  changedBy: Record<string, TravelerId>;
}

export function useSyncSettings(): SyncSettings {
  const [settings, setSettings] = useState(syncSettings.get());
  useEffect(() => syncSettings.subscribe(setSettings), []);
  return settings;
}

/**
 * Keeps a list feature in sync with the group: sends local edits, merges
 * others' changes through `replace` (the feature's replaceAll), and polls
 * while the page is visible. Does nothing until this phone has joined.
 */
export function useListSync<S>(
  adapter: SyncAdapter<S>,
  state: S,
  replace: (next: S) => void,
  loaded: boolean,
): ListSyncView {
  const settings = useSyncSettings();
  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [changedBy, setChangedBy] = useState(() => loadChangedBy(adapter.doc));
  const stateRef = useRef(state);
  stateRef.current = state;
  const running = useRef(false);
  const again = useRef(false);
  const fromSync = useRef(false);
  const joined = isJoined(settings) && WORKER_URL !== null;

  const run = useRef<() => Promise<void>>(async () => {});
  run.current = async () => {
    const current = syncSettings.get();
    if (!isJoined(current) || !WORKER_URL || !loaded) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus((s) => (s === 'synced' || s === 'off' ? 'syncing' : s));
    const outcome: SyncOutcome<S> = await syncDoc({
      adapter,
      getState: () => stateRef.current,
      url: WORKER_URL,
      code: current.code,
      me: current.me,
    });
    running.current = false;
    if (outcome.status === 'synced') {
      setStatus('synced');
      setLastSyncedAt(Date.now());
      setChangedBy(outcome.by);
      if (outcome.state) {
        fromSync.current = true;
        replace(outcome.state);
      }
    } else {
      setStatus(outcome.status);
    }
    if (again.current) {
      again.current = false;
      void run.current();
    }
  };

  // Join/leave, first load, polling, coming back to the tab or online.
  useEffect(() => {
    if (!joined || !loaded) {
      setStatus('off');
      return;
    }
    void run.current();
    const tick = () => document.visibilityState === 'visible' && void run.current();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
    };
  }, [joined, loaded, settings.code, settings.me]);

  // Local edits: send them shortly after (but not the state we just merged in).
  useEffect(() => {
    if (!joined || !loaded) return;
    if (fromSync.current) {
      fromSync.current = false;
      return;
    }
    const timer = setTimeout(() => void run.current(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return { status, lastSyncedAt, settings, changedBy };
}
