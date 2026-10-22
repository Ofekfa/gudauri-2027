import { useEffect, useState } from 'preact/hooks';
import { getAlbum, refreshAlbum, startAlbum, subscribeAlbum, type AlbumSnapshot } from './service';

const REFRESH_MS = 60_000;

/** The album snapshot; refreshes on mount, every minute and when the tab returns. */
export function useAlbum(): AlbumSnapshot {
  const [snap, setSnap] = useState(getAlbum);
  useEffect(() => {
    const off = subscribeAlbum(setSnap);
    void startAlbum();
    void refreshAlbum();
    const timer = setInterval(
      () => document.visibilityState === 'visible' && void refreshAlbum(),
      REFRESH_MS,
    );
    return () => {
      off();
      clearInterval(timer);
    };
  }, []);
  return snap;
}
