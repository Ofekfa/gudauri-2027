import { useEffect, useState } from 'preact/hooks';
import { music, type MusicView } from './musicStore';

export function useMusic(): MusicView {
  const [view, setView] = useState<MusicView>(() => music.getView());
  useEffect(() => music.subscribe(setView), []);
  return view;
}
