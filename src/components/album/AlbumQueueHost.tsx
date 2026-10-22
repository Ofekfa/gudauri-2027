import { useEffect } from 'preact/hooks';
import { appStore } from '../../lib/storage/safeStorage';

/** Same key as service.PENDING_FLAG_KEY; duplicated so the shell doesn't load the album. */
const PENDING_FLAG_KEY = 'album:pending';

/** Resumes uploads left over from an earlier visit, without loading album code otherwise. */
export function AlbumQueueHost() {
  useEffect(() => {
    if (appStore.get(PENDING_FLAG_KEY))
      void import('../../lib/album/service').then((m) => m.startAlbum());
  }, []);
  return null;
}
