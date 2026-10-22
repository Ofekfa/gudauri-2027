import { useEffect, useState } from 'preact/hooks';

export const HOME_PATH = '/';

/** "#/flights?x=1" → "/flights". Anything unrecognisable maps to home. */
export function parseHash(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  if (!path.startsWith('/')) return HOME_PATH;
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return trimmed || HOME_PATH;
}

/** Query parameters after the route: "#/packing?who=maya" → who=maya. */
export function parseHashQuery(hash: string): URLSearchParams {
  const index = hash.indexOf('?');
  return new URLSearchParams(index === -1 ? '' : hash.slice(index + 1));
}

/** "/food/khinkali" → "/food" (a section plus one detail segment); other paths are unchanged. */
export function basePath(path: string): string {
  const match = /^(\/[^/]+)\/[^/]+$/.exec(path);
  return match ? match[1]! : path;
}

export interface RouteMatch<T> {
  page: T;
  /** The section path, e.g. "/food" for "/food/khinkali". */
  base: string;
  /** The detail segment, decoded, when the route takes one. */
  param?: string;
}

/**
 * Exact routes first, then "section + one segment" routes (e.g. "/food/:id").
 * Deeper paths never match, so they fall through to Not Found.
 */
export function matchRoute<E, P>(
  path: string,
  exact: Readonly<Record<string, E>>,
  withParam: Readonly<Record<string, P>>,
): RouteMatch<E> | RouteMatch<P> | null {
  const page = exact[path];
  if (page) return { page, base: path };
  const base = basePath(path);
  const paramPage = base === path ? undefined : withParam[base];
  if (!paramPage) return null;
  let param: string;
  try {
    param = decodeURIComponent(path.slice(base.length + 1));
  } catch {
    return null;
  }
  return { page: paramPage, base, param };
}

export function href(path: string, params?: Record<string, string>): string {
  const query = params ? new URLSearchParams(params).toString() : '';
  return query ? `#${path}?${query}` : `#${path}`;
}

export function useHashPath(): string {
  const [path, setPath] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setPath(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    // Effects run after first paint: catch a hash change that happened before we subscribed.
    onChange();
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}
