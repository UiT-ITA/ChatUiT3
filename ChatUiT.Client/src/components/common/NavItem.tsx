import React from 'react';
import { Icon, type IconName } from './Icon';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './NavItem.css';

export interface NavItemProps extends LayoutProps, Omit<React.ComponentProps<'button'>, 'title' | 'width'> {
  active?: boolean;
  icon?: IconName;
  // Content before the label, such as a section number. Takes the accent color when active.
  leading?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  // Content at the right end, such as a count
  trailing?: React.ReactNode;
  // 1 is a main entry, 2 a sub-entry under it
  level?: 1 | 2;
  // Where the active marker sits: the start edge, or under the item as in a tab bar
  indicator?: 'start' | 'bottom';
}

/** One entry in a navigation list. */
const NavItem: React.FC<NavItemProps> = ({ active = false, icon, leading, description, meta, trailing, level = 1, indicator = 'start', className, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  const stacked = Boolean(description || meta);

  return (
    <button
      type="button"
      className={cx('nav-item', `nav-item--level-${level}`, `nav-item--indicator-${indicator}`, active && 'nav-item--active', level === 1 ? 't-ui' : 't-ui-plain', className)}
      style={style}
      aria-current={active ? 'page' : undefined}
      {...rest}
    >
      {icon && <Icon name={icon} color={active ? 'inherit' : 'secondary'} className="nav-item__icon" />}
      {leading && <span className="nav-item__leading">{leading}</span>}
      <span className={cx('nav-item__text', stacked && 'nav-item__text--stacked')}>
        <span className="nav-item__label">{children}</span>
        {description && <span className="nav-item__description t-caption">{description}</span>}
        {meta && <span className="nav-item__meta t-meta">{meta}</span>}
      </span>
      {trailing && <span className="nav-item__trailing">{trailing}</span>}
    </button>
  );
};

export default NavItem;
