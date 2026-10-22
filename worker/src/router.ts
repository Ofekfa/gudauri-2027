/**
 * Tiny route table with a shared pipeline:
 * path → (public? skip) origin allowlist → CORS preflight → method → per-IP rate limit → handler.
 * Paths may contain ":name" segments (e.g. "/album/:frameId/photos"); several
 * routes can share a path with different methods.
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
  /** Decoded ":name" segments from the path. */
  params: Record<string, string>;
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Route {
  method: Method;
  path: string;
  /** Public routes (health) skip the origin allowlist and CORS. */
  public?: boolean;
  rateLimit?: RateLimitBinding;
  handler(ctx: RouteContext): Promise<Response>;
}

const RETRY_AFTER_S = '60';

interface CompiledRoute {
  route: Route;
  pattern: RegExp;
  names: string[];
}

function compile(route: Route): CompiledRoute {
  const names: string[] = [];
  const source = route.path
    .split('/')
    .map((part) => {
      if (!part.startsWith(':')) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      names.push(part.slice(1));
      return '([^/]+)';
    })
    .join('/');
  return { route, pattern: new RegExp(`^${source}$`), names };
}

function decodeParams(match: RegExpExecArray, names: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
  try {
    names.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1]!)));
  } catch {
    return null;
  }
  return params;
}

export function createRouter(routes: Route[]) {
  const compiled = routes.map(compile);

  return async function handle(request: Request, env: Env, now = new Date()): Promise<Response> {
    const url = new URL(request.url);
    // Every route whose path matches; they differ only by method.
    const candidates = compiled.flatMap((c) => {
      const m = c.pattern.exec(url.pathname);
      return m ? [{ ...c, match: m }] : [];
    });
    if (candidates.length === 0) return errorJson(404, 'Not found');
    const methods = [...new Set(candidates.map((c) => c.route.method))];
    const chosen = candidates.find((c) => c.route.method === request.method);
    const params = chosen ? decodeParams(chosen.match, chosen.names) : {};
    if (params === null) return errorJson(400, 'Bad path');

    if (chosen?.route.public)
      return chosen.route.handler({ request, env, url, cors: {}, now, params });

    const origin = allowedOrigin(request, env);
    if (!origin) return errorJson(403, 'Origin not allowed');
    const cors = corsHeaders(origin, methods.join(', '));

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!chosen) {
      return errorJson(405, `Use ${methods.join(' or ')}`, {
        ...cors,
        Allow: `${methods.join(', ')}, OPTIONS`,
      });
    }
    const route = chosen.route;

    const limiter = route.rateLimit ? env[route.rateLimit] : undefined;
    if (limiter) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await limiter.limit({ key: ip });
      if (!success)
        return errorJson(429, 'Too many requests', { ...cors, 'Retry-After': RETRY_AFTER_S });
    }

    return route.handler({ request, env, url, cors, now, params });
  };
}
