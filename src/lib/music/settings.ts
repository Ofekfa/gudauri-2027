/**
 * Music settings: on by default for first-time visitors, except on
 * Save-Data / very slow connections. An explicit choice always wins.
 */
import { appStore, type KeyValueStore } from '../storage/safeStorage';
import { loadVersioned, saveVersioned, type VersionedSpec } from '../storage/versioned';

const VERSION = 1;
export const DEFAULT_VOLUME = 0.6;

export interface MusicSettings {
  version: typeof VERSION;
  enabled: boolean;
  volume: number;
  /** True once the visitor has chosen; until then the default may follow the connection. */
  chosen: boolean;
}

export interface ConnectionHints {
  saveData?: boolean;
  effectiveType?: string;
}

/** Save-Data or a 2G-class connection means we don't start music unasked. */
export const prefersNoAutoMusic = (c: ConnectionHints | undefined) =>
  Boolean(c?.saveData) || c?.effectiveType === '2g' || c?.effectiveType === 'slow-2g';

const clampVolume = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;

export const settingsSpec: VersionedSpec<MusicSettings> = {
  key: 'music:settings',
  version: VERSION,
  validate: (raw) => {
    const r = raw as Partial<MusicSettings> | null;
    if (!r || typeof r.enabled !== 'boolean') return null;
    return {
      version: VERSION,
      enabled: r.enabled,
      volume: clampVolume(r.volume),
      chosen: r.chosen !== false,
    };
  },
  empty: () => ({ version: VERSION, enabled: true, volume: DEFAULT_VOLUME, chosen: false }),
};

/** Effective settings for this visit (the connection only affects the unchosen default). */
export function loadMusicSettings(
  connection?: ConnectionHints,
  store: KeyValueStore = appStore,
): MusicSettings {
  const settings = loadVersioned(store, settingsSpec).value;
  if (!settings.chosen && prefersNoAutoMusic(connection)) return { ...settings, enabled: false };
  return settings;
}

export function saveMusicSettings(
  change: Partial<Pick<MusicSettings, 'enabled' | 'volume'>>,
  current: MusicSettings,
  store: KeyValueStore = appStore,
): MusicSettings {
  const next: MusicSettings = {
    ...current,
    ...change,
    volume: clampVolume(change.volume ?? current.volume),
    // Turning music on or off is a choice; adjusting volume isn't.
    chosen: current.chosen || change.enabled !== undefined,
  };
  saveVersioned(store, settingsSpec, next);
  return next;
}
