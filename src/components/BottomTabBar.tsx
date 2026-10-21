import { href } from '../lib/router/hashRouter';
import { activeTabPath, TAB_BAR_ITEMS } from '../navigation';
import { Icon } from './Icon';

interface BottomTabBarProps {
  activePath: string;
}

export function BottomTabBar({ activePath }: BottomTabBarProps) {
  const activeTab = activeTabPath(activePath);
  return (
    <nav class="tab-bar" aria-label="Main">
      <ul>
        {TAB_BAR_ITEMS.map((item) => (
          <li key={item.path}>
            <a href={href(item.path)} aria-current={activeTab === item.path ? 'page' : undefined}>
              <Icon name={item.icon} />
              <span>{item.navLabel}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
