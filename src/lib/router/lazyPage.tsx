import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

type Loader = () => Promise<{ default: ComponentType }>;

/** Code-splits a page: its chunk downloads only when the route is first visited. */
export function lazyPage(load: Loader): ComponentType {
  let cached: ComponentType | null = null;

  return function LazyPage() {
    const [Page, setPage] = useState<ComponentType | null>(() => cached);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      if (Page) return;
      load()
        .then((mod) => {
          cached = mod.default;
          setPage(() => mod.default);
        })
        .catch(() => setFailed(true));
    }, [Page]);

    if (Page) return <Page />;
    if (failed) {
      return (
        <p class="card" role="alert">
          This page couldn’t load. Check your connection and{' '}
          <button type="button" class="link-button" onClick={() => window.location.reload()}>
            try again
          </button>
          .
        </p>
      );
    }
    return (
      <p class="page-loading" role="status">
        Loading…
      </p>
    );
  };
}
