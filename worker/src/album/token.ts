/**
 * Album access tokens: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 * Issued for the group code; checked on every change to the album.
 */
import { trip, type TravelerId } from '../../../src/data/trip';

export interface AlbumToken {
  v: 1;
  who: TravelerId;
  /** Expiry, epoch seconds. */
  exp: number;
}

/** Tokens last at least through the trip and a little after. */
export const TOKEN_VALID_UNTIL_MS = Date.parse('2027-03-15T23:59:59Z');
export const TOKEN_MIN_LIFETIME_MS = 30 * 86_400_000;
const TRAVELERS = trip.travelers.map((t) => t.id);
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

export const tokenExpiry = (nowMs: number) =>
  Math.floor(Math.max(TOKEN_VALID_UNTIL_MS, nowMs + TOKEN_MIN_LIFETIME_MS) / 1000);

export async function signToken(payload: AlbumToken, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)),
  );
  return `${body}.${b64url(sig)}`;
}

/** The payload if the signature is ours and it hasn't expired; otherwise null. */
export async function verifyToken(
  token: string,
  secret: string,
  nowMs: number,
): Promise<AlbumToken | null> {
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  let ok = false;
  try {
    // crypto.subtle.verify compares in constant time.
    ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromB64url(sig),
      enc.encode(body),
    );
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Partial<AlbumToken>;
    if (p.v !== 1 || !TRAVELERS.includes(p.who as TravelerId) || typeof p.exp !== 'number')
      return null;
    return p.exp * 1000 > nowMs ? (p as AlbumToken) : null;
  } catch {
    return null;
  }
}
