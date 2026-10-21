export type IdGenerator = () => string;

export const defaultIdGenerator: IdGenerator = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
