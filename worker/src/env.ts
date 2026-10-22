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
  ALLOWED_ORIGINS: string;
  MODEL: string;
}

export type RateLimitBinding = 'RATE_LIMITER' | 'RL_DATA';
