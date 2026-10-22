import { describe, expect, it, vi } from 'vitest';
import type { SyncRequest } from '../../src/lib/sync/protocol';
import type { Env } from '../src/env';
import { handleRequest } from '../src/index';
import { codeMatches } from '../src/routes/sync';
import { applySync, memoryRecordStore } from '../src/sync/recordStore';

const ORIGIN = 'https://ofekfa.github.io';
const CODE = 'khinkali-at-midnight-2027';
const req = (over: Partial<SyncRequest> = {}): SyncRequest => ({
  doc: 'packing',
  since: 0,
  by: 'ofek',
  changes: [],
  ...over,
});
const item = (id: string, name: string) => JSON.stringify({ id, name });

describe('shared-list merge rules', () => {
  it('stores changes, bumps the revision and returns what the phone has not seen', () => {
    const store = memoryRecordStore();
    const first = applySync(
      store,
      req({ changes: [{ key: 'item/ofek/a', value: item('a', 'Gloves') }] }),
    );
    expect(first.rev).toBe(1);
    expect(first.changes).toEqual([
      { key: 'item/ofek/a', value: item('a', 'Gloves'), by: 'ofek', rev: 1 },
    ]);
    const maya = applySync(
      store,
      req({ by: 'maya', since: 0, changes: [{ key: 'item/maya/b', value: item('b', 'Goggles') }] }),
    );
    expect(maya.changes.map((c) => c.key)).toEqual(['item/ofek/a', 'item/maya/b']);
    const caughtUp = applySync(store, req({ since: maya.rev }));
    expect(caughtUp.changes).toEqual([]);
  });

  it('lets the last change to arrive win, and keeps deletions as tombstones', () => {
    const store = memoryRecordStore();
    applySync(store, req({ changes: [{ key: 'item/ofek/a', value: item('a', 'Gloves') }] }));
    applySync(
      store,
      req({ by: 'ron', changes: [{ key: 'item/ofek/a', value: item('a', 'Warm gloves') }] }),
    );
    const deleted = applySync(
      store,
      req({ by: 'roy', changes: [{ key: 'item/ofek/a', value: null }] }),
    );
    expect(deleted.changes).toEqual([{ key: 'item/ofek/a', value: null, by: 'roy', rev: 3 }]);
  });

  it('does not bump the revision for resends, and keeps docs apart', () => {
    const store = memoryRecordStore();
    const change = { key: 'item/ofek/a', value: item('a', 'Gloves') };
    applySync(store, req({ changes: [change] }));
    expect(applySync(store, req({ since: 1, changes: [change] })).rev).toBe(1);
    expect(applySync(store, req({ doc: 'todo' })).changes).toEqual([]);
  });

  it('refuses to grow past the record cap', () => {
    const store = memoryRecordStore();
    const many = (from: number) =>
      Array.from({ length: 600 }, (_, i) => ({ key: `item/ofek/i${from + i}`, value: '1' }));
    for (let n = 0; n < 5; n++) applySync(store, req({ changes: many(n * 600) }));
    expect(() =>
      applySync(store, req({ changes: [{ key: 'item/ofek/one-more', value: '1' }] })),
    ).toThrow('TooManyRecords');
  });
});

describe('POST /sync', () => {
  const env = (over: Partial<Env> = {}): Env => {
    const store = memoryRecordStore();
    return {
      AI: { run: vi.fn() },
      RL_DATA: { limit: vi.fn().mockResolvedValue({ success: true }) },
      ALLOWED_ORIGINS: ORIGIN,
      MODEL: 'm',
      GROUP_CODE: CODE,
      LISTS: {
        idFromName: () => 'id',
        get: () => ({ sync: async (r: SyncRequest) => applySync(store, r) }),
      },
      ...over,
    };
  };
  const post = (e: Env, body: unknown, code: string | null = CODE) =>
    handleRequest(
      new Request('https://w.example/sync', {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          'Content-Type': 'application/json',
          ...(code ? { Authorization: `Bearer ${code}` } : {}),
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
      e,
    );

  it('is off until the group code is set', async () => {
    expect((await post(env({ GROUP_CODE: undefined }), req())).status).toBe(501);
  });

  it('rejects a missing or wrong code, bad JSON and bad requests', async () => {
    const e = env();
    expect((await post(e, req(), null)).status).toBe(401);
    expect((await post(e, req(), 'guess')).status).toBe(401);
    expect((await post(e, '{nope')).status).toBe(400);
    expect((await post(e, { ...req(), by: 'stranger' })).status).toBe(400);
    expect((await post(e, req({ changes: [{ key: '../etc', value: '1' }] }))).status).toBe(400);
    expect(
      (await post(e, req({ changes: [{ key: 'item/ofek/a', value: 'not json' }] }))).status,
    ).toBe(400);
  });

  it('round-trips changes between two phones', async () => {
    const e = env();
    const ofek = await post(
      e,
      req({ changes: [{ key: 'item/ofek/a', value: item('a', 'Gloves') }] }),
    );
    expect(ofek.status).toBe(200);
    expect(ofek.headers.get('Cache-Control')).toBe('no-store');
    const maya = (await (await post(e, req({ by: 'maya' }))).json()) as {
      rev: number;
      changes: { key: string; by: string }[];
    };
    expect(maya.changes).toEqual([expect.objectContaining({ key: 'item/ofek/a', by: 'ofek' })]);
  });

  it('allows the Authorization header in CORS preflights', async () => {
    const res = await handleRequest(
      new Request('https://w.example/sync', { method: 'OPTIONS', headers: { Origin: ORIGIN } }),
      env(),
    );
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('compares codes exactly', async () => {
    expect(await codeMatches(CODE, CODE)).toBe(true);
    expect(await codeMatches(`${CODE} `, CODE)).toBe(false);
    expect(await codeMatches('', CODE)).toBe(false);
  });
});
