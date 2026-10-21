/**
 * Tiny route table with a shared pipeline:
 * path → (public? skip) origin allowlist → CORS preflight → method → per-IP rate limit → handler.
 */
import { allowedOrigin, corsHeaders } from './cors';
import type { Env, RateLimitBinding } from './env';
import { errorJson } from './http';

export interface RouteContext {
  request: Request;
  env: Env;
  url: URL;
  /** CORS headers to attach to every response (empty for public routes). */
  cors: HeadersInit;
  now: Date;
}

export interface Route {
  method: 'GET' | 'POST';
  path: string;
  /** Public routes (health) skip the origin allowlist and CORS. */
  public?: boolean;
  rateLimit?: RateLimitBinding;
  handler(ctx: RouteContext): Promise<Response>;
}

const RETRY_AFTER_S = '60';

export function createRouter(routes: Route[]) {
  const byPath = new Map(routes.map((r) => [r.path, r]));

  return async function handle(request: Request, env: Env, now = new Date()): Promise<Response> {
    const url = new URL(request.url);
    const route = byPath.get(url.pathname);
    if (!route) return errorJson(404, 'Not found');
    if (route.public) return route.handler({ request, env, url, cors: {}, now });

    const origin = allowedOrigin(request, env);
    if (!origin) return errorJson(403, 'Origin not allowed');
    const cors = corsHeaders(origin, route.method);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== route.method) {
      return errorJson(405, `Use ${route.method}`, { ...cors, Allow: `${route.method}, OPTIONS` });
    }

    const limiter = route.rateLimit ? env[route.rateLimit] : undefined;
    if (limiter) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await limiter.limit({ key: ip });
      if (!success)
        return errorJson(429, 'Too many requests', { ...cors, 'Retry-After': RETRY_AFTER_S });
    }

    return route.handler({ request, env, url, cors, now });
  };
}
