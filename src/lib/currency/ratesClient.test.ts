import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '../storage/safeStorage';
import { fetchRates, loadCachedRates, saveCachedRates } from './ratesClient';

const PAYLOAD = {
  base: 'GEL',
  gelPer: { ILS: 0.84, EUR: 2.92 },
  validFrom: '2026-10-22',
  source: 'nbg',
  fetchedAt: '2026-10-22T10:00:00.000Z',
  stale: false,
} as const;

describe('rates client', () => {
  it('fetches and validates the Worker payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(PAYLOAD)));
    await expect(fetchRates('https://w.example', fetchImpl)).resolves.toEqual(PAYLOAD);
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://w.example/rates');
  });

  it('rejects bad responses and a missing URL', async () => {
    const bad = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...PAYLOAD, gelPer: {} })));
    await expect(fetchRates('https://w.example', bad)).rejects.toThrow();
    const down = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(fetchRates('https://w.example', down)).rejects.toThrow(/503/);
    await expect(fetchRates(null)).rejects.toThrow();
  });

  it('keeps the last rates for offline use, versioned', () => {
    const store = createMemoryStore();
    expect(loadCachedRates(store)).toBeNull();
    saveCachedRates(PAYLOAD, store);
    expect(loadCachedRates(store)).toEqual(PAYLOAD);
    expect(JSON.parse(store.get('currency:rates')!).version).toBe(1);
    store.set('currency:rates', '{"version":1,"payload":{"gelPer":"junk"}}');
    expect(loadCachedRates(store)).toBeNull();
  });
});
