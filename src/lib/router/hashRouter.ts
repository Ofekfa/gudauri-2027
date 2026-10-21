import { useEffect, useState } from 'preact/hooks';

export const HOME_PATH = '/';

/** "#/flights?x=1" → "/flights". Anything unrecognisable maps to home. */
export function parseHash(hash: string): string {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  if (!path.startsWith('/')) return HOME_PATH;
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return trimmed || HOME_PATH;
}

export function href(path: string): string {
  return `#${path}`;
}

export function useHashPath(): string {
  const [path, setPath] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setPath(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}
