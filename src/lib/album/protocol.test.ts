import { describe, expect, it } from 'vitest';
import { cleanCaption, parseListing, parseUploadMeta } from './protocol';

const meta = {
  id: 'abcdef12-3456',
  uploadedBy: 'maya',
  uploadedAt: '2027-02-25T10:00:00Z',
  width: 2048,
  height: 1536,
  thumbWidth: 480,
  thumbHeight: 360,
};

describe('album protocol', () => {
  it('validates upload metadata', () => {
    expect(parseUploadMeta(meta)).toMatchObject({
      id: 'abcdef12-3456',
      uploadedBy: 'maya',
      uploadedAt: '2027-02-25T10:00:00.000Z',
    });
    expect(parseUploadMeta({ ...meta, uploadedBy: 'stranger' })).toBeNull();
    expect(parseUploadMeta({ ...meta, id: '../x' })).toBeNull();
    expect(parseUploadMeta({ ...meta, width: 99999 })).toBeNull();
    expect(parseUploadMeta({ ...meta, uploadedAt: 'yesterday' })).toBeNull();
  });

  it('cleans captions', () => {
    expect(cleanCaption('  Who\nthrew\tfirst?  ')).toBe('Who threw first?');
    expect(cleanCaption('a\u0000b\u0007')).toBe('a b');
    expect(cleanCaption('x'.repeat(300))).toHaveLength(120);
    expect(cleanCaption('   ')).toBeUndefined();
    expect(cleanCaption(42)).toBeUndefined();
  });

  it('drops unknown frames and bad photos from a listing', () => {
    const listing = parseListing({
      frames: { snowman: { version: 2, coverPhotoId: 'abcdef12-3456' }, nope: { version: 1 } },
      photos: [
        { ...meta, frameId: 'snowman', version: 1, caption: ' Olaf ' },
        { ...meta, frameId: 'nope', version: 1 },
        { bad: true },
      ],
    });
    expect(listing.frames).toEqual({ snowman: { version: 2, coverPhotoId: 'abcdef12-3456' } });
    expect(listing.photos).toHaveLength(1);
    expect(listing.photos[0]!.caption).toBe('Olaf');
    expect(() => parseListing(null)).toThrow();
  });
});
