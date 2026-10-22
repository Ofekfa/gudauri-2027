import { ALBUM_FRAMES } from '../../data/album';
import type { AlbumPhoto } from './protocol';
import { photosByFrame } from './selectors';
import { createZip, zipName, type ZipEntry } from './zip';

/** Rough average size of a full photo, for the download estimate. */
export const AVERAGE_PHOTO_BYTES = 800_000;
const FILE_NAME = 'gudauri-2027-album.zip';

/** Fetches every full-size photo in story order and saves them as one ZIP. */
export async function downloadAlbum(
  photos: readonly AlbumPhoto[],
  urlOf: (id: string) => string,
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  const byFrame = photosByFrame(photos);
  const entries: ZipEntry[] = [];
  const total = photos.length;
  for (const [index, frame] of ALBUM_FRAMES.entries()) {
    for (const [n, photo] of (byFrame.get(frame.id) ?? []).entries()) {
      const res = await fetch(urlOf(photo.id));
      if (!res.ok) throw new Error(`Photo ${photo.id} unavailable`);
      entries.push({
        name: zipName(index + 1, frame.title, n + 1),
        data: new Uint8Array(await res.arrayBuffer()),
      });
      onProgress(entries.length, total);
    }
  }
  const url = URL.createObjectURL(createZip(entries));
  const a = document.createElement('a');
  a.href = url;
  a.download = FILE_NAME;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
