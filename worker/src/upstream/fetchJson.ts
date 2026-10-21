import { UPSTREAM_TIMEOUT_MS } from '../limits';

const USER_AGENT = 'gudauri-2027 (github.com/Ofekfa/gudauri-2027)';

/** GETs JSON from an upstream API; throws on network errors, timeouts and non-2xx. */
export async function fetchJson(url: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Upstream ${new URL(url).host} responded ${res.status}`);
  return res.json();
}
