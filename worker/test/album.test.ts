import { describe, expect, it, vi } from 'vitest';
import { MAX_PHOTOS_PER_FRAME } from '../../src/data/album';
import { hasExif } from '../../src/lib/album/jpeg';
import {
  MAX_CUSTOM_MOMENTS,
  MAX_FULL_BYTES,
  MAX_UPLOAD_BYTES,
  type AlbumPhoto,
} from '../../src/lib/album/protocol';
import { MAX_BODY_BYTES } from '../src/limits';
import {
  addPhoto,
  createMoment,
  deleteMoment,
  listing,
  memoryImageDb,
  memoryIndexDb,
  removePhoto,
  setCaption,
  setCover,
  updateMoment,
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
    deleteAllImages: async () => images(name).deleteAll(),
    getMoment: async (id) => idx.getMoment(id),
    createMoment: async (input, meta) => createMoment(idx, input, meta),
    updateMoment: async (id, patch) => updateMoment(idx, id, patch),
    deleteMoment: async (id) => deleteMoment(idx, id),
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

describe('album uploads: body size and CORS', () => {
  it('accepts real photo sizes, far above the chat body limit', async () => {
    const { session, upload } = setup();
    const token = await session();
    const full = fakeJpeg(MAX_FULL_BYTES - 100);
    expect(full.length).toBeGreaterThan(MAX_BODY_BYTES * 50);
    expect((await upload(token, 'snowman', 'photo-big1', full)).status).toBe(201);
  });

  it('rejects a declared body over the upload limit with a readable 413', async () => {
    const { call, session } = setup();
    const token = await session();
    const res = await call('/album/snowman/photos', {
      method: 'POST',
      token,
      body: 'x',
      headers: { 'Content-Length': String(MAX_UPLOAD_BYTES + 1) },
    });
    expect(res.status).toBe(413);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('lets the browser preflight every album change with Authorization and If-Match', async () => {
    const { call } = setup();
    const cases = [
      ['/album/session', 'POST'],
      ['/album/snowman/photos', 'POST'],
      ['/album/photos/photo-0001', 'PATCH'],
      ['/album/photos/photo-0001', 'DELETE'],
      ['/album/snowman/cover', 'PUT'],
    ] as const;
    for (const [path, method] of cases) {
      const res = await call(path, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': method,
          'Access-Control-Request-Headers': 'authorization, content-type, if-match',
        },
      });
      expect(res.status, `${method} ${path}`).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain(method);
      const allowed = res.headers.get('Access-Control-Allow-Headers')!.toLowerCase();
      for (const h of ['authorization', 'content-type', 'if-match']) expect(allowed).toContain(h);
    }
    const stranger = await call('/album/snowman/photos', {
      method: 'OPTIONS',
      origin: 'https://evil.example',
      headers: { 'Access-Control-Request-Method': 'POST' },
    });
    expect(stranger.status).toBe(403);
  });

  // Without CORS headers on errors the browser reports status 0, and the
  // client can't tell "not set up" or "wrong token" from "offline".
  it('sends CORS headers on 501, 401 and 429 so the client can read them', async () => {
    const off = setup({ ALBUM_SIGNING_KEY: undefined });
    const notSetUp = await off.call('/album/session', {
      method: 'POST',
      body: JSON.stringify({ code: CODE, who: 'maya' }),
    });
    expect(notSetUp.status).toBe(501);
    expect(notSetUp.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const offUpload = await off.upload('whatever', 'snowman', 'photo-0001');
    expect(offUpload.status).toBe(501);
    expect(offUpload.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);

    const { upload } = setup();
    const badToken = await upload('not-a-token', 'snowman', 'photo-0001');
    expect(badToken.status).toBe(401);
    expect(badToken.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);

    const limited = setup({ RL_DATA: { limit: vi.fn().mockResolvedValue({ success: false }) } });
    const tooMany = await limited.upload('whatever', 'snowman', 'photo-0001');
    expect(tooMany.status).toBe(429);
    expect(tooMany.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });
});

describe('album photos', () => {
  it('allows If-Match in preflight for caption and cover edits', async () => {
    const { call } = setup();
    const res = await call('/album/photos/photo-0001', {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Method': 'PATCH' },
    });
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('If-Match');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
  });

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
    expect(img.headers.get('Access-Control-Allow-Origin')).toBe('*');
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

describe('custom moments', () => {
  const breakfast = {
    title: 'Breakfast',
    emoji: '🥐',
    prompt: 'Khachapuri for breakfast?',
    after: 'bar',
  };
  type Call = ReturnType<typeof setup>['call'];
  const post = (call: Call, token: string, body: unknown) =>
    call('/album/moments', { method: 'POST', token, body: JSON.stringify(body) });
  const patch = (call: Call, token: string, id: string, body: unknown) =>
    call(`/album/moments/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) });
  const listed = async (call: Call) =>
    (await (await call('/album')).json()) as {
      moments: { id: string; title: string; orderKey: string; prompt?: string }[];
      photos: AlbumPhoto[];
      frames: Record<string, unknown>;
    };
  type Created = { id: string; orderKey: string; title: string; createdBy: string };

  it('needs a token, and the album to be set up', async () => {
    const { call } = setup();
    expect((await post(call, '', breakfast)).status).toBe(401);
    const off = setup({ ALBUM_SIGNING_KEY: undefined });
    expect((await post(off.call, 'whatever', breakfast)).status).toBe(501);
  });

  it('adds a moment after the chosen one, with a server id, and lists it', async () => {
    const { call, session } = setup();
    const token = await session('roy');
    const res = await post(call, token, breakfast);
    expect(res.status).toBe(201);
    const moment = (await res.json()) as Created;
    expect(moment).toMatchObject({
      title: 'Breakfast',
      emoji: '🥐',
      createdBy: 'roy',
      custom: true,
    });
    expect(moment.id).toMatch(/^m-[0-9a-z]{10}$/);
    expect((await listed(call)).moments.map((m) => m.id)).toEqual([moment.id]);
  });

  it('validates title, emoji, prompt and place, and cleans text', async () => {
    const { call, session } = setup();
    const token = await session();
    for (const bad of [
      { ...breakfast, title: '' },
      { ...breakfast, title: 'x'.repeat(41) },
      { ...breakfast, emoji: '💩' },
      { ...breakfast, prompt: 'p'.repeat(81) },
      { ...breakfast, after: 'nowhere' },
      { ...breakfast, after: undefined },
    ])
      expect((await post(call, token, bad)).status).toBe(400);
    expect((await call('/album/moments', { method: 'POST', token, body: '{' })).status).toBe(400);
    const res = await post(call, token, { ...breakfast, title: '  Late‮  breakfast\n' });
    expect(((await res.json()) as Created).title).toBe('Late breakfast');
  });

  it('caps the number of our own moments', async () => {
    const { call, session } = setup();
    const token = await session();
    for (let i = 0; i < MAX_CUSTOM_MOMENTS; i++)
      expect((await post(call, token, { ...breakfast, title: `M${i}` })).status).toBe(201);
    expect((await post(call, token, breakfast)).status).toBe(409);
  });

  it('refuses to change or delete predefined moments (403)', async () => {
    const { call, session } = setup();
    const token = await session();
    expect((await patch(call, token, 'snowman', { title: 'Snow dude' })).status).toBe(403);
    expect((await call('/album/moments/snowman', { method: 'DELETE', token })).status).toBe(403);
    expect((await call('/album/moments/m-0000000000', { method: 'DELETE', token })).status).toBe(
      404,
    );
  });

  it('edits only the given fields, and moves without renumbering others', async () => {
    const { call, session } = setup();
    const token = await session();
    const a = (await (await post(call, token, breakfast)).json()) as Created;
    const b = (await (
      await post(call, token, { ...breakfast, title: 'Sauna', after: 'gondola' })
    ).json()) as Created;
    // Two of us at once: one renames, the other moves. Both changes stay.
    const [rename, move] = await Promise.all([
      patch(call, token, a.id, { title: 'Brunch' }),
      patch(call, token, a.id, { after: 'snowman' }),
    ]);
    expect([rename.status, move.status]).toEqual([200, 200]);
    const list = await listed(call);
    const moved = list.moments.find((m) => m.id === a.id)!;
    expect(moved.title).toBe('Brunch');
    expect(moved.orderKey).not.toBe(a.orderKey);
    expect(list.moments.find((m) => m.id === b.id)!.orderKey).toBe(b.orderKey);
    const cleared = await patch(call, token, a.id, { prompt: '' });
    expect(((await cleared.json()) as { prompt?: string }).prompt).toBeUndefined();
    expect((await patch(call, token, a.id, { after: a.id })).status).toBe(400);
    expect((await patch(call, token, a.id, { emoji: '💩' })).status).toBe(400);
  });

  it('takes photos and covers like any moment, and deleting removes them all', async () => {
    const { call, session, upload, album } = setup();
    const token = await session();
    const m = (await (await post(call, token, breakfast)).json()) as Created;
    expect((await upload(token, m.id, 'photo-b001')).status).toBe(201);
    expect((await upload(token, m.id, 'photo-b002')).status).toBe(201);
    expect((await upload(token, 'snowman', 'photo-s001')).status).toBe(201);
    const cover = await call(`/album/${m.id}/cover`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ photoId: 'photo-b002' }),
    });
    expect(cover.status).toBe(200);

    expect((await call(`/album/moments/${m.id}`, { method: 'DELETE', token })).status).toBe(204);
    const list = await listed(call);
    expect(list.moments).toEqual([]);
    expect(list.photos.map((p) => p.id)).toEqual(['photo-s001']);
    expect(list.frames[m.id]).toBeUndefined();
    expect(album.images(`frame:${m.id}`).get('photo-b001', 'full')).toBeNull();
    expect(album.images('frame:snowman').get('photo-s001', 'full')).not.toBeNull();
    const img = await call('/album/photos/photo-b001/image?size=thumb', { origin: null });
    expect(img.status).toBe(404);

    // A photo still queued on someone's phone for the deleted moment.
    const late = await upload(token, m.id, 'photo-b003');
    expect(late.status).toBe(410);
    expect(((await late.json()) as { error: string }).error).toBe('This moment was deleted');
    expect((await upload(token, 'not-a-moment', 'photo-x001')).status).toBe(400);
  });

  it('keeps both moments when two of us add at the same spot', async () => {
    const { call, session } = setup();
    const token = await session();
    const [one, two] = await Promise.all([
      post(call, token, { ...breakfast, title: 'One' }),
      post(call, token, { ...breakfast, title: 'Two' }),
    ]);
    expect([one.status, two.status]).toEqual([201, 201]);
    const keys = (await listed(call)).moments.map((m) => m.orderKey);
    expect(new Set(keys).size).toBe(2);
  });

  it('allows PATCH and DELETE on moments in the CORS preflight', async () => {
    const { call } = setup();
    const res = await call('/album/moments/m-0000000000', {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Method': 'PATCH' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
  });
});
