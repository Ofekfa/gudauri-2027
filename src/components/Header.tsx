import { href } from '../lib/router/hashRouter';
import { activeTabPath, HOME, TAB_BAR_ITEMS } from '../navigation';
import { Icon } from './Icon';
import { trip } from '../data/trip';

interface HeaderProps {
  activePath: string;
}

export function Header({ activePath }: HeaderProps) {
  const activeTab = activeTabPath(activePath);
  return (
    <header class="site-header">
      <a class="brand" href={href(HOME.path)} aria-label={`${trip.name} — Home`}>
        <span class="brand__logo" aria-hidden="true">
          <Icon name="snowflake" size={22} />
        </span>
        <span class="brand__text">
          Gudauri <span class="brand__year">2027</span>
        </span>
      </a>
      <nav class="desktop-nav" aria-label="Main">
        <ul>
          {TAB_BAR_ITEMS.map((item) => (
            <li key={item.path}>
              <a href={href(item.path)} aria-current={activeTab === item.path ? 'page' : undefined}>
                <Icon name={item.icon} size={18} />
                {item.navLabel}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
