import { describe, expect, it, vi } from 'vitest';
import { MAX_PHOTOS_PER_FRAME } from '../../src/data/album';
import { hasExif } from '../../src/lib/album/jpeg';
import type { AlbumPhoto } from '../../src/lib/album/protocol';
import {
  addPhoto,
  listing,
  memoryImageDb,
  memoryIndexDb,
  removePhoto,
  setCaption,
  setCover,
  type ImageDb,
} from '../src/album/logic';
import { signToken, verifyToken } from '../src/album/token';
import type { Env } from '../src/env';
import { handleRequest } from '../src/index';
import type { AlbumStub } from '../src/routes/album';

const ORIGIN = 'https://ofekfa.github.io';
const CODE = 'khinkali-at-midnight';
const KEY = 'test-signing-key-123';
const NOW = Date.parse('2027-02-25T10:00:00Z');

/** A minimal JPEG: SOI, an EXIF APP1 with "GPS", start of scan, data, EOI. */
const fakeJpeg = (extra = 0) =>
  new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    0x00,
    0x0e,
    0x45,
    0x78,
    0x69,
    0x66,
    0,
    0,
    0x47,
    0x50,
    0x53,
    0,
    0,
    0,
    0xff,
    0xda,
    0x00,
    0x02,
    ...new Array(extra).fill(7),
    0xff,
    0xd9,
  ]);

/** Durable Object namespace backed by the real logic, in memory. */
function fakeAlbum() {
  const idx = memoryIndexDb();
  const frames = new Map<string, ImageDb>();
  const images = (name: string) => frames.get(name) ?? frames.set(name, memoryImageDb()).get(name)!;
  const stub = (name: string): AlbumStub => ({
    list: async () => listing(idx),
    getPhoto: async (id) => idx.getPhoto(id),
    addPhoto: async (p) => addPhoto(idx, p),
    setCaption: async (id, c, m) => setCaption(idx, id, c, m),
    setCover: async (f, p, m) => setCover(idx, f, p, m),
    removePhoto: async (id) => removePhoto(idx, id),
    putImages: async (id, full, thumb) => {
      images(name).put(id, 'full', full);
      images(name).put(id, 'thumb', thumb);
    },
    getImage: async (id, size) => images(name).get(id, size),
    deleteImages: async (id) => images(name).delete(id),
  });
  return { ns: { idFromName: (n: string) => n, get: (n: unknown) => stub(n as string) }, images };
}

function setup(over: Partial<Env> = {}) {
  const album = fakeAlbum();
  const env: Env = {
    AI: { run: vi.fn() },
    RL_DATA: { limit: vi.fn().mockResolvedValue({ success: true }) },
    RL_AUTH: { limit: vi.fn().mockResolvedValue({ success: true }) },
    ALLOWED_ORIGINS: ORIGIN,
    MODEL: 'm',
    GROUP_CODE: CODE,
    ALBUM_SIGNING_KEY: KEY,
    ALBUM: album.ns,
    ...over,
  };
  const call = (
    path: string,
    init: RequestInit & { token?: string; origin?: string | null } = {},
  ) => {
    const headers = new Headers(init.headers);
    if (init.origin !== null) headers.set('Origin', init.origin ?? ORIGIN);
    if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
    return handleRequest(
      new Request(`https://w.example${path}`, { ...init, headers }),
      env,
      new Date(NOW),
    );
  };
  const session = async (who = 'maya') => {
    const res = await call('/album/session', {
      method: 'POST',
      body: JSON.stringify({ code: CODE, who }),
    });
    return ((await res.json()) as { token: string }).token;
  };
  const upload = (
    token: string,
    frameId: string,
    id: string,
    full = fakeJpeg(),
    thumb = fakeJpeg(),
  ) => {
    const form = new FormData();
    form.set(
      'meta',
      JSON.stringify({
        id,
        uploadedBy: 'ron',
        uploadedAt: '2027-02-25T09:59:00Z',
        width: 2048,
        height: 1536,
        thumbWidth: 480,
        thumbHeight: 360,
      }),
    );
    form.set('full', new File([full], 'f.jpg', { type: 'image/jpeg' }));
    form.set('thumb', new File([thumb], 't.jpg', { type: 'image/jpeg' }));
    return call(`/album/${frameId}/photos`, { method: 'POST', body: form, token });
  };
  return { env, call, session, upload, album };
}

describe('album tokens', () => {
  it('verify only our own, unexpired, untampered tokens', async () => {
    const exp = Math.floor(NOW / 1000) + 60;
    const token = await signToken({ v: 1, who: 'ofek', exp }, KEY);
    expect(await verifyToken(token, KEY, NOW)).toEqual({ v: 1, who: 'ofek', exp });
    expect(await verifyToken(token, 'other-key', NOW)).toBeNull();
    expect(await verifyToken(token, KEY, NOW + 61_000)).toBeNull();
    const [body, sig] = token.split('.');
    const forged = btoa(JSON.stringify({ v: 1, who: 'maya', exp })).replace(/=+$/, '');
    expect(await verifyToken(`${forged}.${sig}`, KEY, NOW)).toBeNull();
    expect(await verifyToken(`${body}`, KEY, NOW)).toBeNull();
  });
});

describe('POST /album/session', () => {
  it('is off until set up, rejects wrong codes, and issues long-lived tokens', async () => {
    const off = setup({ ALBUM_SIGNING_KEY: undefined });
    expect((await off.call('/album/session', { method: 'POST', body: '{}' })).status).toBe(501);
    const { call } = setup();
    expect(
      (
        await call('/album/session', {
          method: 'POST',
          body: JSON.stringify({ code: 'nope', who: 'ofek' }),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await call('/album/session', {
          method: 'POST',
          body: JSON.stringify({ code: CODE, who: 'stranger' }),
        })
      ).status,
    ).toBe(400);
    const res = await call('/album/session', {
      method: 'POST',
      body: JSON.stringify({ code: CODE, who: 'ofek' }),
    });
    const { expiresAt } = (await res.json()) as { expiresAt: string };
    expect(expiresAt).toBe('2027-03-27T10:00:00.000Z'); // now + 30 days, as that's after 15 Mar
  });

  it('renews silently with a valid token, and is strictly rate limited', async () => {
    const { call, session } = setup();
    const token = await session('roy');
    const renewed = await call('/album/session', { method: 'POST', token });
    expect(renewed.status).toBe(200);
    const limited = setup({ RL_AUTH: { limit: vi.fn().mockResolvedValue({ success: false }) } });
    expect((await limited.call('/album/session', { method: 'POST', body: '{}' })).status).toBe(429);
  });
});

describe('album photos', () => {
  it('lets anyone view, but only token holders change', async () => {
    const { call, upload } = setup();
    expect((await call('/album')).status).toBe(200);
    expect((await upload('', 'snowman', 'photo-0001')).status).toBe(401);
    expect((await call('/album/photos/photo-0001', { method: 'DELETE' })).status).toBe(401);
  });

  it('adds a photo idempotently, strips EXIF, and serves it publicly with caching', async () => {
    const { call, session, upload, album } = setup();
    const token = await session();
    const added = await upload(token, 'snowman', 'photo-0001');
    expect(added.status).toBe(201);
    expect(((await added.json()) as AlbumPhoto).frameId).toBe('snowman');
    expect((await upload(token, 'snowman', 'photo-0001')).status).toBe(200);
    expect(hasExif(album.images('frame:snowman').get('photo-0001', 'full')!)).toBe(false);
    const listingRes = (await (await call('/album')).json()) as { photos: AlbumPhoto[] };
    expect(listingRes.photos.map((p) => p.id)).toEqual(['photo-0001']);
    const img = await call('/album/photos/photo-0001/image?size=thumb', { origin: null });
    expect(img.status).toBe(200);
    expect(img.headers.get('Content-Type')).toBe('image/jpeg');
    expect(img.headers.get('Cache-Control')).toContain('immutable');
    expect(img.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(img.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('validates uploads: frame, type, size and the per-frame cap', async () => {
    const { session, upload } = setup();
    const token = await session();
    expect((await upload(token, 'nowhere', 'photo-0001')).status).toBe(400);
    expect(
      (await upload(token, 'snowman', 'photo-0002', new Uint8Array([0x89, 0x50, 0x4e, 0x47])))
        .status,
    ).toBe(415);
    expect((await upload(token, 'snowman', 'photo-0003', fakeJpeg(1_700_000))).status).toBe(413);
    for (let i = 0; i < MAX_PHOTOS_PER_FRAME; i++)
      expect((await upload(token, 'bar', `cap-${String(i).padStart(6, '0')}`)).status).toBe(201);
    expect((await upload(token, 'bar', 'cap-one-too-many')).status).toBe(409);
  });

  it('edits captions and covers with ETags, and deletes (anyone of us)', async () => {
    const { call, session, upload } = setup();
    const token = await session();
    await upload(token, 'skiing', 'photo-aaaa');
    await upload(token, 'skiing', 'photo-bbbb');
    const caption = (body: object, match: string) =>
      call('/album/photos/photo-aaaa', {
        method: 'PATCH',
        token,
        headers: { 'If-Match': match },
        body: JSON.stringify(body),
      });
    const ok = await caption({ caption: '  First run!\n ' }, '"1"');
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as AlbumPhoto).caption).toBe('First run!');
    const stale = await caption({ caption: 'Second' }, '"1"');
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { current: AlbumPhoto }).current.caption).toBe('First run!');
    const cover = (photoId: string, match: string) =>
      call('/album/skiing/cover', {
        method: 'PUT',
        token,
        headers: { 'If-Match': match },
        body: JSON.stringify({ photoId }),
      });
    expect((await cover('photo-bbbb', '0')).status).toBe(200);
    expect((await cover('photo-aaaa', '0')).status).toBe(409);
    expect((await cover('photo-zzzz', '1')).status).toBe(404);
    // Deleting the cover photo resets the cover.
    expect(
      (await call('/album/photos/photo-bbbb', { method: 'DELETE', token: await session('ron') }))
        .status,
    ).toBe(204);
    const after = (await (await call('/album')).json()) as {
      frames: Record<string, { coverPhotoId?: string }>;
    };
    expect(after.frames.skiing?.coverPhotoId).toBeUndefined();
    expect((await call('/album/photos/photo-bbbb/image', { origin: null })).status).toBe(404);
  });
});
