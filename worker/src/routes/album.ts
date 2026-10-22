/**
 * Album routes. Viewing is public (listing and images); every change needs a
 * token from POST /album/session, issued for the group code.
 */
import { findFrame } from '../../../src/data/album';
import { trip, type TravelerId } from '../../../src/data/trip';
import { isJpeg, stripJpegMetadata } from '../../../src/lib/album/jpeg';
import { isPredefined } from '../../../src/lib/album/moments';
import {
  cleanCaption,
  MAX_CUSTOM_MOMENTS,
  MAX_FULL_BYTES,
  MAX_THUMB_BYTES,
  MAX_UPLOAD_BYTES,
  MOMENT_ID,
  parseMomentInput,
  parseUploadMeta,
  PHOTO_ID,
  type AlbumFrameState,
  type AlbumListing,
  type AlbumPhoto,
  type CustomMoment,
  type ImageSize,
  type MomentInput,
} from '../../../src/lib/album/protocol';
import type { AddResult, EditResult, MomentResult } from '../album/logic';
import { signToken, tokenExpiry, verifyToken, type AlbumToken } from '../album/token';
import type { Env } from '../env';
import { errorJson, json } from '../http';
import type { Route, RouteContext } from '../router';
import { codeMatches } from './sync';

/** The Durable Object stub's RPC surface (see album/AlbumStore.ts). */
export interface AlbumStub {
  list(): Promise<AlbumListing>;
  getPhoto(id: string): Promise<AlbumPhoto | null>;
  addPhoto(photo: AlbumPhoto): Promise<AddResult>;
  setCaption(
    id: string,
    caption: string | undefined,
    ifMatch: number | null,
  ): Promise<EditResult<AlbumPhoto>>;
  setCover(
    frameId: string,
    photoId: string,
    ifMatch: number | null,
  ): Promise<EditResult<AlbumFrameState>>;
  removePhoto(id: string): Promise<AlbumPhoto | null>;
  putImages(photoId: string, full: Uint8Array, thumb: Uint8Array): Promise<void>;
  getImage(photoId: string, size: ImageSize): Promise<Uint8Array | null>;
  deleteImages(photoId: string): Promise<void>;
  deleteAllImages(): Promise<void>;
  getMoment(id: string): Promise<CustomMoment | null>;
  createMoment(
    input: MomentInput,
    meta: { id: string; createdBy: TravelerId; createdAt: string },
  ): Promise<MomentResult>;
  updateMoment(id: string, patch: Partial<MomentInput>): Promise<MomentResult>;
  deleteMoment(id: string): Promise<string[] | null>;
}

const TRAVELERS = trip.travelers.map((t) => t.id);
const IMAGE_MAX_AGE_S = 31_536_000;
const index = (env: Env) => env.ALBUM!.get(env.ALBUM!.idFromName('index'));
const frameStore = (env: Env, frameId: string) =>
  env.ALBUM!.get(env.ALBUM!.idFromName(`frame:${frameId}`));
const ready = (env: Env) => Boolean(env.ALBUM && env.GROUP_CODE && env.ALBUM_SIGNING_KEY);

const bearer = (request: Request) => {
  const auth = request.headers.get('Authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
};

/** The token's payload, or an error response. */
async function authorise({
  request,
  env,
  cors,
  now,
}: RouteContext): Promise<AlbumToken | Response> {
  if (!ready(env)) return errorJson(501, 'Album not set up', cors);
  const token = await verifyToken(bearer(request), env.ALBUM_SIGNING_KEY!, now.getTime());
  return token ?? errorJson(401, 'Join the group to change the album', cors);
}

/** "3" or "\"3\"" → 3; absent → null (no check). */
function ifMatch(request: Request): number | null | 'bad' {
  const raw = request.headers.get('If-Match');
  if (raw === null) return null;
  const n = Number(raw.replace(/^W\//, '').replace(/"/g, ''));
  return Number.isInteger(n) && n >= 0 ? n : 'bad';
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('too big');
  return JSON.parse(text);
}

const SMALL_BODY = 4_000;
const MOMENT_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const MOMENT_ID_LENGTH = 10;
const GONE = 'This moment was deleted';

/** "m-" + 10 random base-36 characters (never a predefined slug). */
function newMomentId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(MOMENT_ID_LENGTH));
  return `m-${[...bytes].map((b) => MOMENT_ID_CHARS[b % MOMENT_ID_CHARS.length]).join('')}`;
}

/** A predefined frame or a stored custom moment; 410 for a custom moment that's gone. */
async function checkFrame(env: Env, frameId: string, cors: HeadersInit): Promise<Response | null> {
  if (findFrame(frameId)) return null;
  if (MOMENT_ID.test(frameId) && (await index(env).getMoment(frameId))) return null;
  return MOMENT_ID.test(frameId)
    ? errorJson(410, GONE, cors)
    : errorJson(400, 'Unknown frame', cors);
}

export const albumSessionRoute: Route = {
  method: 'POST',
  path: '/album/session',
  rateLimit: 'RL_AUTH',
  async handler(ctx) {
    const { request, env, cors, now } = ctx;
    if (!ready(env)) return errorJson(501, 'Album not set up', cors);
    // Silent renewal with a still-valid token.
    const current = await verifyToken(bearer(request), env.ALBUM_SIGNING_KEY!, now.getTime());
    let who: TravelerId;
    if (current) {
      who = current.who;
    } else {
      let body: unknown;
      try {
        body = await readJson(request, SMALL_BODY);
      } catch {
        return errorJson(400, 'Invalid request', cors);
      }
      const { code, who: claimed } = (body ?? {}) as { code?: unknown; who?: unknown };
      if (typeof code !== 'string' || !TRAVELERS.includes(claimed as TravelerId))
        return errorJson(400, 'Invalid request', cors);
      if (!(await codeMatches(code, env.GROUP_CODE!)))
        return errorJson(401, 'Wrong group code', cors);
      who = claimed as TravelerId;
    }
    const exp = tokenExpiry(now.getTime());
    const token = await signToken({ v: 1, who, exp }, env.ALBUM_SIGNING_KEY!);
    return json(
      200,
      { token, expiresAt: new Date(exp * 1000).toISOString() },
      { ...cors, 'Cache-Control': 'no-store' },
    );
  },
};

export const albumListRoute: Route = {
  method: 'GET',
  path: '/album',
  rateLimit: 'RL_DATA',
  async handler({ env, cors }) {
    if (!env.ALBUM) return errorJson(501, 'Album not set up', cors);
    return json(200, await index(env).list(), { ...cors, 'Cache-Control': 'no-store' });
  },
};

export const albumAddRoute: Route = {
  method: 'POST',
  path: '/album/:frameId/photos',
  rateLimit: 'RL_DATA',
  async handler(ctx) {
    const auth = await authorise(ctx);
    if (auth instanceof Response) return auth;
    const { request, env, cors, params } = ctx;
    const badFrame = await checkFrame(env, params.frameId!, cors);
    if (badFrame) return badFrame;
    if (Number(request.headers.get('Content-Length') ?? '0') > MAX_UPLOAD_BYTES)
      return errorJson(413, 'Photo too large', cors);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return errorJson(400, 'Expected a form upload', cors);
    }
    let meta;
    try {
      meta = parseUploadMeta(JSON.parse(String(form.get('meta') ?? '')));
    } catch {
      meta = null;
    }
    if (!meta) return errorJson(400, 'Bad photo details', cors);
    const full = form.get('full');
    const thumb = form.get('thumb');
    if (!(full instanceof File) || !(thumb instanceof File))
      return errorJson(400, 'Missing image', cors);
    if (full.size > MAX_FULL_BYTES || thumb.size > MAX_THUMB_BYTES)
      return errorJson(413, 'Photo too large', cors);
    const fullBytes = new Uint8Array(await full.arrayBuffer());
    const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
    if (!isJpeg(fullBytes) || !isJpeg(thumbBytes))
      return errorJson(415, 'Photos must be JPEG', cors);

    const store = index(env);
    const existing = await store.getPhoto(meta.id);
    if (existing) return json(200, existing, cors); // a retried upload
    const frameId = params.frameId!;
    await frameStore(env, frameId).putImages(
      meta.id,
      stripJpegMetadata(fullBytes),
      stripJpegMetadata(thumbBytes),
    );
    const result = await store.addPhoto({ ...meta, frameId, version: 1 });
    if (result.status === 'full' || result.status === 'gone') {
      await frameStore(env, frameId).deleteImages(meta.id);
      return result.status === 'full'
        ? errorJson(409, 'This frame is full', cors)
        : errorJson(410, GONE, cors);
    }
    return json(result.status === 'created' ? 201 : 200, result.photo, cors);
  },
};

export const albumCaptionRoute: Route = {
  method: 'PATCH',
  path: '/album/photos/:photoId',
  rateLimit: 'RL_DATA',
  async handler(ctx) {
    const auth = await authorise(ctx);
    if (auth instanceof Response) return auth;
    const { request, env, cors, params } = ctx;
    if (!PHOTO_ID.test(params.photoId!)) return errorJson(404, 'No such photo', cors);
    const version = ifMatch(request);
    if (version === 'bad') return errorJson(400, 'Bad If-Match', cors);
    let body: unknown;
    try {
      body = await readJson(request, SMALL_BODY);
    } catch {
      return errorJson(400, 'Invalid request', cors);
    }
    const result = await index(env).setCaption(
      params.photoId!,
      cleanCaption((body as { caption?: unknown })?.caption),
      version,
    );
    if (result.status === 'missing') return errorJson(404, 'No such photo', cors);
    if (result.status === 'conflict')
      return json(409, { error: 'Someone just updated this', current: result.value }, cors);
    return json(200, result.value, { ...cors, ETag: `"${result.value.version}"` });
  },
};

export const albumDeleteRoute: Route = {
  method: 'DELETE',
  path: '/album/photos/:photoId',
  rateLimit: 'RL_DATA',
  async handler(ctx) {
    const auth = await authorise(ctx);
    if (auth instanceof Response) return auth;
    const { env, cors, params } = ctx;
    if (PHOTO_ID.test(params.photoId!)) {
      const removed = await index(env).removePhoto(params.photoId!);
      if (removed) await frameStore(env, removed.frameId).deleteImages(removed.id);
    }
    return new Response(null, { status: 204, headers: cors });
  },
};

export const albumCoverRoute: Route = {
  method: 'PUT',
  path: '/album/:frameId/cover',
  rateLimit: 'RL_DATA',
  async handler(ctx) {
    const auth = await authorise(ctx);
    if (auth instanceof Response) return auth;
    const { request, env, cors, params } = ctx;
    const badFrame = await checkFrame(env, params.frameId!, cors);
    if (badFrame) return badFrame;
    const version = ifMatch(request);
    if (version === 'bad') return errorJson(400, 'Bad If-Match', cors);
    let photoId: unknown;
    try {
      photoId = ((await readJson(request, SMALL_BODY)) as { photoId?: unknown })?.photoId;
    } catch {
      return errorJson(400, 'Invalid request', cors);
    }
    if (typeof photoId !== 'string' || !PHOTO_ID.test(photoId))
      return errorJson(400, 'Bad photo id', cors);
    const result = await index(env).setCover(params.frameId!, photoId, version);
    if (result.status === 'missing') return errorJson(404, 'No such photo in this frame', cors);
    if (result.status === 'conflict')
      return json(409, { error: 'Someone just updated this', current: result.value }, cors);
    return json(200, result.value, { ...cors, ETag: `"${result.value.version}"` });
  },
};

/** Public: anyone with the site can view; <img> requests carry no Origin. */
export const albumImageRoute: Route = {
  method: 'GET',
  path: '/album/photos/:photoId/image',
  public: true,
  async handler({ env, url, params }) {
    if (!env.ALBUM) return errorJson(501, 'Album not set up');
    const size = url.searchParams.get('size') === 'full' ? 'full' : 'thumb';
    if (!PHOTO_ID.test(params.photoId!)) return errorJson(404, 'No such photo');
    const photo = await index(env).getPhoto(params.photoId!);
    const bytes = photo ? await frameStore(env, photo.frameId).getImage(photo.id, size) : null;
    if (!bytes) return errorJson(404, 'No such photo');
    return new Response(bytes, {
      headers: {
        'Content-Type': 'image/jpeg',
        // Photo bytes never change for an id.
        'Cache-Control': `public, max-age=${IMAGE_MAX_AGE_S}, immutable`,
        ETag: `"${photo!.id}-${size}"`,
        'X-Robots-Tag': 'noindex',
        'X-Content-Type-Options': 'nosniff',
        // Public photos: lets the site fetch them for "Download all" (no credentials).
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

const MOMENT_ERRORS = {
  missing: [404, 'No such moment'],
  'bad-place': [400, 'Pick a place in the album'],
  full: [409, `Up to ${MAX_CUSTOM_MOMENTS} of our own moments`],
} as const;

function momentReply(result: MomentResult, cors: HeadersInit): Response {
  if (result.status === 'created') return json(201, result.moment, cors);
  if (result.status === 'ok') return json(200, result.moment, cors);
  const [status, message] = MOMENT_ERRORS[result.status];
  return errorJson(status, message, cors);
}

/** Only our own moments can change; predefined ones are part of the site. */
function customOnly(id: string, cors: HeadersInit): Response | null {
  if (isPredefined(id)) return errorJson(403, 'Built-in moments can’t be changed', cors);
  if (!MOMENT_ID.test(id)) return errorJson(404, 'No such moment', cors);
  return null;
}

async function momentBody(request: Request, partial: boolean) {
  try {
    return parseMomentInput(await readJson(request, SMALL_BODY), partial);
  } catch {
    return { ok: false as const, error: 'Invalid request' };
  }
}

export const albumMomentCreateRoute: Route = {
  method: 'POST',
  path: '/album/moments',
  rateLimit: 'RL_DATA',
  async handler(ctx) {
    const auth = await authorise(ctx);
    if (auth instanceof Response) return auth;
    const { request, env, cors, now } = ctx;
    const input = await momentBody(request, false);
    if (!input.ok) return errorJson(400, input.error, cors);
    const result = await index(env).createMoment(input.value as MomentInput, {
      id: newMomentId(),
      createdBy: auth.who,
      createdAt: now.toISOString(),
    });
    return momentReply(result, cors);
  },
};

export const albumMomentEditRoute: Route = {
  method: 'PATCH',
  path: '/album/moments/:momentId',
  rateLimit: 'RL_DATA',
  async handler(ctx) {
    const auth = await authorise(ctx);
    if (auth instanceof Response) return auth;
    const { request, env, cors, params } = ctx;
    const refused = customOnly(params.momentId!, cors);
    if (refused) return refused;
    const patch = await momentBody(request, true);
    if (!patch.ok) return errorJson(400, patch.error, cors);
    return momentReply(await index(env).updateMoment(params.momentId!, patch.value), cors);
  },
};

/** Deletes the moment with all its photos, for everyone (any of us may). */
export const albumMomentDeleteRoute: Route = {
  method: 'DELETE',
  path: '/album/moments/:momentId',
  rateLimit: 'RL_DATA',
  async handler(ctx) {
    const auth = await authorise(ctx);
    if (auth instanceof Response) return auth;
    const { env, cors, params } = ctx;
    const refused = customOnly(params.momentId!, cors);
    if (refused) return refused;
    const removed = await index(env).deleteMoment(params.momentId!);
    if (!removed) return errorJson(404, 'No such moment', cors);
    await frameStore(env, params.momentId!).deleteAllImages();
    return new Response(null, { status: 204, headers: cors });
  },
};

export const albumRoutes = [
  albumMomentCreateRoute,
  albumMomentEditRoute,
  albumMomentDeleteRoute,
  albumSessionRoute,
  albumListRoute,
  albumAddRoute,
  albumCaptionRoute,
  albumDeleteRoute,
  albumCoverRoute,
  albumImageRoute,
];
