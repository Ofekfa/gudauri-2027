import type { ComponentType } from 'preact';
import { useEffect } from 'preact/hooks';
import { BottomTabBar } from './components/BottomTabBar';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { trip } from './data/trip';
import { useHashPath } from './lib/router/hashRouter';
import { lazyPage } from './lib/router/lazyPage';
import { MapBackground } from './components/map/MapBackground';
import { Snowfall } from './components/Snowfall';
import { ToastHost } from './components/ToastHost';
import { findNavItem, HOME } from './navigation';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { FlightsPage } from './pages/FlightsPage';
import { GamePlaceholderPage } from './pages/GamePlaceholderPage';
import { HomePage } from './pages/HomePage';
import { MorePage } from './pages/MorePage';
import { NotFoundPage } from './pages/NotFoundPage';

const PAGES: Record<string, ComponentType> = {
  '/': HomePage,
  '/flights': FlightsPage,
  '/game': GamePlaceholderPage,
  '/map': lazyPage(() => import('./pages/MapPage')),
  '/packing': lazyPage(() => import('./pages/PackingPage')),
  '/more': MorePage,
};

function focusMain() {
  document.getElementById('main')?.focus();
}

export function App() {
  const path = useHashPath();
  const item = findNavItem(path);

  useEffect(() => {
    document.title = item && item !== HOME ? `${item.title} · ${trip.name}` : trip.name;
  }, [item]);

  useEffect(() => {
    // After the first route, page headings take focus on navigation (see PageHeader).
    const onNav = () => {
      document.body.dataset.navigated = 'true';
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onNav);
    return () => window.removeEventListener('hashchange', onNav);
  }, []);

  const Page = PAGES[path];
  let content;
  if (Page) content = <Page />;
  else if (item?.comingSoon) content = <ComingSoonPage item={item} />;
  else content = <NotFoundPage />;

  return (
    <>
      {/* A button, not href="#main": the URL hash is reserved for routing. */}
      <button type="button" class="skip-link" onClick={focusMain}>
        Skip to content
      </button>
      <MapBackground />
      <Snowfall />
      <Header activePath={path} />
      <main id="main" class="page" key={path} tabIndex={-1}>
        {content}
      </main>
      <Footer />
      <ToastHost />
      <BottomTabBar activePath={path} />
    </>
  );
}
