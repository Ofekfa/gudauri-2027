import { useEffect, useRef } from 'preact/hooks';
import { href } from '../lib/router/hashRouter';
import { HOME } from '../navigation';
import { Icon } from './Icon';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Hide the "Back to Home" link (used on Home itself). */
  isHome?: boolean;
  /** Where the back link goes instead of Home (e.g. a dish page back to its list). */
  back?: { path: string; label: string };
}

/** Page title + way back. Receives focus on navigation so screen readers announce the new page. */
export function PageHeader({ title, subtitle, isHome = false, back }: PageHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Skip on first load so we don't steal focus from the browser's default.
    if (document.body.dataset.navigated) headingRef.current?.focus({ preventScroll: true });
  }, [title]);

  return (
    <div class="page-header">
      {!isHome && (
        <a class="back-link" href={href(back?.path ?? HOME.path)}>
          <Icon name="arrowLeft" size={18} />
          {back?.label ?? 'Back to Home'}
        </a>
      )}
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {subtitle && <p class="page-header__subtitle">{subtitle}</p>}
    </div>
  );
}
