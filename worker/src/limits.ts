/** Abuse-protection limits. Requests outside them are rejected before any AI call. */
export const MAX_MESSAGE_CHARS = 500;
export const MAX_MESSAGES = 10;
export const MAX_BODY_BYTES = 16_000;
/** Keeps answers short enough to read aloud and cheap on the free quota. */
export const MAX_OUTPUT_TOKENS = 320;
export const TEMPERATURE = 0.4;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Upstream requests give up after this long. */
export const UPSTREAM_TIMEOUT_MS = 8_000;

/** NBG publishes once a day (~21:00 Tbilisi); 12 h keeps us at most half a day behind. */
export const RATES_TTL_MS = 12 * HOUR_MS;
export const RATES_MAX_STALE_MS = 7 * DAY_MS;
/** Browsers may reuse a /rates response this long. */
export const RATES_BROWSER_MAX_AGE_S = 600;

/** Calendar edits show up within this long. */
export const ITINERARY_TTL_MS = 20 * MINUTE_MS;
export const ITINERARY_MAX_STALE_MS = 7 * DAY_MS;
export const ITINERARY_BROWSER_MAX_AGE_S = 60;
/** Refuse absurdly large feeds (a busy multi-year calendar is a few hundred kB). */
export const MAX_ICS_BYTES = 3_000_000;
