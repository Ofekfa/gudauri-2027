import type { ComponentType } from 'preact';
import { useEffect } from 'preact/hooks';
import { BottomTabBar } from './components/BottomTabBar';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { trip } from './data/trip';
import { matchRoute, useHashPath } from './lib/router/hashRouter';
import { lazyPage } from './lib/router/lazyPage';
import { MapBackground } from './components/map/MapBackground';
import { Snowfall } from './components/Snowfall';
import { ToastHost } from './components/ToastHost';
import { FactPopups } from './components/facts/FactPopups';
import { findNavItem, HOME } from './navigation';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { FlightsPage } from './pages/FlightsPage';
import { HomePage } from './pages/HomePage';
import { MorePage } from './pages/MorePage';
import { NotFoundPage } from './pages/NotFoundPage';

const PAGES: Record<string, ComponentType> = {
  '/': HomePage,
  '/flights': FlightsPage,
  '/game': lazyPage(() => import('./pages/GamePage')),
  '/map': lazyPage(() => import('./pages/MapPage')),
  '/packing': lazyPage(() => import('./pages/PackingPage')),
  '/facts': lazyPage(() => import('./pages/FactsPage')),
  '/assistant': lazyPage(() => import('./pages/AssistantPage')),
  '/currency': lazyPage(() => import('./pages/CurrencyPage')),
  '/todo': lazyPage(() => import('./pages/TodoPage')),
  '/itinerary': lazyPage(() => import('./pages/ItineraryPage')),
  '/weather': lazyPage(() => import('./pages/WeatherPage')),
  '/food': lazyPage(() => import('./pages/FoodPage')),
  '/credits': lazyPage(() => import('./pages/CreditsPage')),
  '/more': MorePage,
};

/** Pages that take one detail segment, e.g. "/food/:id"; they receive it as `param`. */
export interface ParamPageProps {
  param: string;
}
const PARAM_PAGES: Record<string, ComponentType<ParamPageProps>> = {
  '/food': lazyPage<ParamPageProps>(() => import('./pages/FoodDetailPage')),
};

function focusMain() {
  document.getElementById('main')?.focus();
}

export function App() {
  const path = useHashPath();
  const route = matchRoute(path, PAGES, PARAM_PAGES);
  // Detail pages ("/food/khinkali") belong to their section for titles and navigation.
  const sectionPath = route?.base ?? path;
  const item = findNavItem(sectionPath);

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

  let content;
  if (route?.param !== undefined) {
    const DetailPage = route.page as ComponentType<ParamPageProps>;
    content = <DetailPage param={route.param} />;
  } else if (route) {
    const Page = route.page as ComponentType;
    content = <Page />;
  } else if (item?.comingSoon) content = <ComingSoonPage item={item} />;
  else content = <NotFoundPage />;

  return (
    <>
      {/* A button, not href="#main": the URL hash is reserved for routing. */}
      <button type="button" class="skip-link" onClick={focusMain}>
        Skip to content
      </button>
      <MapBackground />
      <Snowfall />
      <Header activePath={sectionPath} />
      <main id="main" class="page" key={path} tabIndex={-1}>
        {content}
      </main>
      <Footer />
      <ToastHost />
      <FactPopups path={sectionPath} />
      <BottomTabBar activePath={sectionPath} />
    </>
  );
}
