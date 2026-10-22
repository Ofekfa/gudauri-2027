import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '../storage/safeStorage';
import { syncSettings } from '../sync/settings';
import { getAlbumToken } from './token';

const NOW = Date.parse('2027-02-25T10:00:00Z');
const DAY = 86_400_000;
const sessionReply = (token: string, expiresAt: number) =>
  new Response(JSON.stringify({ token, expiresAt: new Date(expiresAt).toISOString() }));

describe('album token', () => {
  afterEach(() => syncSettings.leave());

  it('needs the phone to have joined the group', async () => {
    syncSettings.leave();
    expect(
      await getAlbumToken(NOW, {
        store: createMemoryStore(),
        url: 'https://w',
        fetchImpl: vi.fn(),
      }),
    ).toEqual({ error: 'not-joined' });
  });

  it('fetches once, reuses it, and renews quietly near expiry', async () => {
    syncSettings.join('group-code', 'roy');
    const store = createMemoryStore();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(sessionReply('t1', NOW + 20 * DAY))
      .mockResolvedValueOnce(sessionReply('t2', NOW + 40 * DAY));
    expect(await getAlbumToken(NOW, { store, url: 'https://w', fetchImpl })).toEqual({
      token: 't1',
    });
    expect(await getAlbumToken(NOW + DAY, { store, url: 'https://w', fetchImpl })).toEqual({
      token: 't1',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // 10 days later only 9 are left: renew with the current token.
    expect(await getAlbumToken(NOW + 11 * DAY, { store, url: 'https://w', fetchImpl })).toEqual({
      token: 't2',
    });
    expect(fetchImpl.mock.calls[1]![1].headers.Authorization).toBe('Bearer t1');
  });

  it('reports a wrong code and keeps a valid token when offline', async () => {
    syncSettings.join('wrong', 'maya');
    const store = createMemoryStore();
    expect(
      await getAlbumToken(NOW, {
        store,
        url: 'https://w',
        fetchImpl: vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
      }),
    ).toEqual({ error: 'wrong-code' });
    syncSettings.join('group-code', 'maya');
    await getAlbumToken(NOW, {
      store,
      url: 'https://w',
      fetchImpl: vi.fn().mockResolvedValue(sessionReply('t1', NOW + 10 * DAY)),
    });
    const offline = vi.fn().mockRejectedValue(new TypeError('offline'));
    expect(await getAlbumToken(NOW + DAY, { store, url: 'https://w', fetchImpl: offline })).toEqual(
      { token: 't1' },
    );
    expect(
      await getAlbumToken(NOW + 11 * DAY, { store, url: 'https://w', fetchImpl: offline }),
    ).toEqual({ error: 'offline' });
  });
});
