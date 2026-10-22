import { useEffect, useState } from 'preact/hooks';
import { syncSettings, type SyncSettings } from './settings';

export function useSyncSettings(): SyncSettings {
  const [settings, setSettings] = useState(syncSettings.get);
  useEffect(() => syncSettings.subscribe(setSettings), []);
  return settings;
}
