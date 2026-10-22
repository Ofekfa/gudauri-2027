/**
 * Turns a camera/gallery file into the two JPEGs we upload: up to 2048 px
 * (≤ 1.5 MB) and a 480 px thumbnail. Re-encoding through a canvas applies the
 * EXIF orientation and drops all metadata (incl. GPS); stripJpegMetadata is a
 * final guarantee. JPEG because Safari can't encode WebP.
 */
import { stripJpegMetadata } from './jpeg';

export const FULL_EDGE = 2048;
export const THUMB_EDGE = 480;
export const MAX_FULL_OUTPUT = 1_500_000;
const QUALITIES = [0.82, 0.72, 0.62] as const;
const FALLBACK_EDGES = [1600, 1280] as const;
const THUMB_QUALITY = 0.78;

export class UnsupportedImageError extends Error {
  constructor() {
    super(
      'This photo format isn’t supported here. In Photos, share it as JPEG (“Most Compatible”) and try again.',
    );
  }
}

/** Scales (w, h) to fit within `max` on the long edge; never upscales. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Tries quality steps at the full edge, then smaller edges, until the result
 * fits `maxBytes`. `encode` renders at a long edge and quality.
 */
export async function encodeWithin<T extends { blob: Blob }>(
  encode: (edge: number, quality: number) => Promise<T>,
  maxBytes: number,
): Promise<T> {
  let last: T | null = null;
  for (const edge of [FULL_EDGE, ...FALLBACK_EDGES]) {
    for (const quality of QUALITIES) {
      last = await encode(edge, quality);
      if (last.blob.size <= maxBytes) return last;
    }
  }
  return last!;
}

type Drawable = ImageBitmap | HTMLImageElement;

async function decode(file: Blob): Promise<Drawable> {
  try {
    // Applies EXIF orientation (default 'from-image').
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new UnsupportedImageError();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function render(
  source: Drawable,
  edge: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const size = fitWithin(source.width, source.height, edge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UnsupportedImageError();
  ctx.drawImage(source, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob || blob.type !== 'image/jpeg') throw new UnsupportedImageError();
  const clean = stripJpegMetadata(new Uint8Array(await blob.arrayBuffer()));
  return { blob: new Blob([clean as BlobPart], { type: 'image/jpeg' }), ...size };
}

export interface ProcessedPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
}

export async function processImage(file: Blob): Promise<ProcessedPhoto> {
  const source = await decode(file);
  try {
    const full = await encodeWithin(
      (edge, quality) => render(source, edge, quality),
      MAX_FULL_OUTPUT,
    );
    const thumb = await render(source, THUMB_EDGE, THUMB_QUALITY);
    return {
      full: full.blob,
      thumb: thumb.blob,
      width: full.width,
      height: full.height,
      thumbWidth: thumb.width,
      thumbHeight: thumb.height,
    };
  } finally {
    if ('close' in source) source.close();
  }
}
