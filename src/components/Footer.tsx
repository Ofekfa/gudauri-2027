import { href } from '../lib/router/hashRouter';

export function Footer() {
  return (
    <footer class="site-footer">
      <p>Made with ❄️ for Ofek, Ron, Roy &amp; Maya.</p>
      <p class="site-footer__credit">
        Background map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap contributors
        </a>
        , ODbL. <a href={href('/credits')}>All credits</a>
      </p>
    </footer>
  );
}
