import { ALBUM_FRAMES, type AlbumFrame } from '../../data/album';
import type { AlbumPhoto } from './protocol';
import { photosByFrame } from './selectors';
import { createZip, zipName, type ZipEntry } from './zip';

/** Rough average size of a full photo, for the download estimate. */
export const AVERAGE_PHOTO_BYTES = 800_000;
const FILE_NAME = 'gudauri-2027-album.zip';

/** File names in story order: moment number (merged order), title slug, photo number. */
export function zipPlan(
  photos: readonly AlbumPhoto[],
  moments: readonly AlbumFrame[] = ALBUM_FRAMES,
): { photo: AlbumPhoto; name: string }[] {
  const byFrame = photosByFrame(photos, moments);
  return moments.flatMap((frame, index) =>
    (byFrame.get(frame.id) ?? []).map((photo, n) => ({
      photo,
      name: zipName(index + 1, frame.title, n + 1),
    })),
  );
}

/** Fetches every full-size photo in story order and saves them as one ZIP. */
export async function downloadAlbum(
  photos: readonly AlbumPhoto[],
  urlOf: (id: string) => string,
  onProgress: (done: number, total: number) => void,
  /** Story order (numbering follows it); our own moments included. */
  moments: readonly AlbumFrame[] = ALBUM_FRAMES,
): Promise<void> {
  const plan = zipPlan(photos, moments);
  const entries: ZipEntry[] = [];
  for (const { photo, name } of plan) {
    const res = await fetch(urlOf(photo.id));
    if (!res.ok) throw new Error(`Photo ${photo.id} unavailable`);
    entries.push({ name, data: new Uint8Array(await res.arrayBuffer()) });
    onProgress(entries.length, plan.length);
  }
  const url = URL.createObjectURL(createZip(entries));
  const a = document.createElement('a');
  a.href = url;
  a.download = FILE_NAME;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
