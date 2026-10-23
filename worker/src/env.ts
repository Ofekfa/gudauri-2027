export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Minimal KV surface we use (structurally compatible with Workers KV). */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  AI: { run(model: string, input: unknown): Promise<unknown> };
  /** Chat: 10 requests/minute per IP. */
  RATE_LIMITER?: RateLimiter;
  /** Data routes (rates, weather, itinerary): looser per-IP limit. */
  RL_DATA?: RateLimiter;
  /** Shared response cache; absent locally or before the namespace exists (memory-only then). */
  CACHE?: KvLike;
  /** Secret: the Google Calendar "secret address in iCal format". Never logged or echoed. */
  CALENDAR_ICS_URL?: string;
  /** Secret: the group code that unlocks shared lists. Never logged or echoed. */
  GROUP_CODE?: string;
  /** Signs album tokens (HMAC). Rotating it logs everyone out of the album. */
  ALBUM_SIGNING_KEY?: string;
  /** Session attempts: strict per-IP limit. */
  RL_AUTH?: RateLimiter;
  /** Durable Object namespace for the album (index + one object per frame). */
  ALBUM?: {
    idFromName(name: string): unknown;
    get(id: unknown): import('./routes/album').AlbumStub;
  };
  /** Durable Object namespace for the shared ski-game scores (one instance). */
  SCORES?: {
    idFromName(name: string): unknown;
    get(id: unknown): import('./routes/game').ScoresStub;
  };
  /** Durable Object namespace holding the shared lists. */
  LISTS?: {
    idFromName(name: string): unknown;
    get(id: unknown): {
      sync(
        request: import('../../src/lib/sync/protocol').SyncRequest,
      ): Promise<import('../../src/lib/sync/protocol').SyncResponse>;
    };
  };
  ALLOWED_ORIGINS: string;
  MODEL: string;
}

export type RateLimitBinding = 'RATE_LIMITER' | 'RL_DATA' | 'RL_AUTH';
