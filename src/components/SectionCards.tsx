import { href } from '../lib/router/hashRouter';
import type { NavItem } from '../navigation';
import { Icon } from './Icon';

export function SectionCards({ items }: { items: NavItem[] }) {
  return (
    <ul class="section-cards">
      {items.map((item) => (
        <li key={item.path}>
          <a class="section-card" href={href(item.path)}>
            <span class="section-card__icon">
              <Icon name={item.icon} size={28} />
            </span>
            <span class="section-card__body">
              <span class="section-card__title">
                {item.title}
                {item.comingSoon && <span class="badge">Soon</span>}
              </span>
              <span class="section-card__blurb">{item.blurb}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
