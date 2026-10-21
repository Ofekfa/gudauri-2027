/** Abuse-protection limits. Requests outside them are rejected before any AI call. */
export const MAX_MESSAGE_CHARS = 500;
export const MAX_MESSAGES = 10;
export const MAX_BODY_BYTES = 16_000;
/** Keeps answers short enough to read aloud and cheap on the free quota. */
export const MAX_OUTPUT_TOKENS = 320;
export const TEMPERATURE = 0.4;
