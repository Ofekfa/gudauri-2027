/**
 * Temporary trial switch: `#/game?preset=fast` plays a different difficulty
 * preset and labels it in the HUD. Unknown or missing names play the default
 * unlabelled. Removed once a preset is chosen.
 */
import { DEFAULT_PROFILE, PRESETS, type DifficultyProfile, type PresetName } from './constants';

export interface ActivePreset {
  profile: DifficultyProfile;
  /** Shown in the HUD only when the preset came from the link. */
  label: string | null;
}

export function presetFromQuery(params: URLSearchParams): ActivePreset {
  const name = params.get('preset');
  if (name && Object.hasOwn(PRESETS, name))
    return { profile: PRESETS[name as PresetName], label: name };
  return { profile: DEFAULT_PROFILE, label: null };
}
