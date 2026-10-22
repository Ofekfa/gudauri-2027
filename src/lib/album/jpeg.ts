/**
 * Tiny JPEG helpers (pure, shared by the browser and the Worker): spot a JPEG,
 * and strip every metadata segment (EXIF incl. GPS, XMP, ICC, comments) while
 * keeping the image data. Canvas re-encoding already drops EXIF; this is the
 * belt-and-braces guarantee on both sides.
 */
const SOI = 0xd8;
const EOS = 0xda; // start of scan: entropy-coded data follows
const APP0 = 0xe0;
const APP15 = 0xef;
const COM = 0xfe;

export const isJpeg = (b: Uint8Array) =>
  b.length > 3 && b[0] === 0xff && b[1] === SOI && b[2] === 0xff;

/** True if an APP1 "Exif" segment is present before the image data. */
export function hasExif(b: Uint8Array): boolean {
  for (const seg of segments(b)) {
    if (
      seg.marker === 0xe1 &&
      b[seg.start + 4] === 0x45 &&
      b[seg.start + 5] === 0x78 &&
      b[seg.start + 6] === 0x69 &&
      b[seg.start + 7] === 0x66
    )
      return true;
  }
  return false;
}

interface Segment {
  marker: number;
  /** Offset of the 0xFF marker byte. */
  start: number;
  /** Offset just past the segment. */
  end: number;
}

function* segments(b: Uint8Array): Generator<Segment> {
  if (!isJpeg(b)) return;
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1]!;
    if (marker === EOS) return;
    const length = (b[i + 2]! << 8) | b[i + 3]!;
    yield { marker, start: i, end: i + 2 + length };
    i += 2 + length;
  }
}

/**
 * Copies the JPEG without APP1–APP15 and COM segments (APP0/JFIF is kept so
 * viewers still recognise the file). Returns the input unchanged if it isn't
 * a JPEG.
 */
export function stripJpegMetadata(b: Uint8Array): Uint8Array {
  if (!isJpeg(b)) return b;
  const keep: [number, number][] = [[0, 2]];
  let i = 2;
  for (const seg of segments(b)) {
    const drop = (seg.marker > APP0 && seg.marker <= APP15) || seg.marker === COM;
    if (!drop) keep.push([seg.start, seg.end]);
    i = seg.end;
  }
  keep.push([i, b.length]); // start of scan onwards
  const out = new Uint8Array(keep.reduce((n, [s, e]) => n + (e - s), 0));
  let o = 0;
  for (const [s, e] of keep) {
    out.set(b.subarray(s, e), o);
    o += e - s;
  }
  return out;
}
