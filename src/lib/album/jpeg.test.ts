import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { hasExif, isJpeg, stripJpegMetadata } from './jpeg';

/** A segment: FF <marker> <length incl. itself> <payload>. */
function segment(marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2;
  return new Uint8Array([0xff, marker, len >> 8, len & 0xff, ...payload]);
}
const text = (s: string) => new TextEncoder().encode(s);

/** A real JPEG with EXIF (incl. a GPS-looking payload), XMP and a comment inserted after JFIF. */
async function jpegWithMetadata(): Promise<{ dirty: Uint8Array; base: Uint8Array }> {
  const base = new Uint8Array(
    await sharp({ create: { width: 64, height: 48, channels: 3, background: '#3a6' } })
      .jpeg()
      .toBuffer(),
  );
  // Insert right after the start-of-image marker.
  const app0End = 2;
  const exif = segment(
    0xe1,
    new Uint8Array([...text('Exif\0\0'), ...text('MM\0*GPSLatitude 42.46N GPSLongitude 44.48E')]),
  );
  const xmp = segment(0xe1, text('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>gps</x:xmpmeta>'));
  const comment = segment(0xfe, text('taken at Marco Polo'));
  const dirty = new Uint8Array([
    ...base.subarray(0, app0End),
    ...exif,
    ...xmp,
    ...comment,
    ...base.subarray(app0End),
  ]);
  return { dirty, base };
}

describe('JPEG metadata stripping', () => {
  it('removes EXIF/GPS, XMP and comments but keeps a valid image', async () => {
    const { dirty, base } = await jpegWithMetadata();
    expect(hasExif(dirty)).toBe(true);
    const clean = stripJpegMetadata(dirty);
    expect(isJpeg(clean)).toBe(true);
    expect(hasExif(clean)).toBe(false);
    const asText = new TextDecoder('latin1').decode(clean);
    for (const leak of ['GPSLatitude', 'xmpmeta', 'Marco Polo']) expect(asText).not.toContain(leak);
    // Exactly the original image's segments and data remain.
    expect(clean).toEqual(stripJpegMetadata(base));
    const meta = await sharp(Buffer.from(clean)).metadata();
    expect([meta.width, meta.height, meta.exif]).toEqual([64, 48, undefined]);
  });

  it('leaves clean JPEGs intact and ignores non-JPEGs', async () => {
    const plain = new Uint8Array(
      await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } })
        .jpeg()
        .toBuffer(),
    );
    expect(stripJpegMetadata(plain)).toEqual(plain);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(isJpeg(png)).toBe(false);
    expect(stripJpegMetadata(png)).toBe(png);
  });
});
