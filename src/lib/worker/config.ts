/** Public URL of our Cloudflare Worker (assistant + data routes). Not a secret. */
const base = (import.meta.env.VITE_ASSISTANT_URL ?? '').trim().replace(/\/+$/, '');
export const WORKER_URL: string | null = base || null;
