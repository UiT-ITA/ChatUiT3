import React from 'react';
import { useNavListStyle } from './navListStyle';
import { Icon, type IconName } from './Icon';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './NavItem.css';

export interface NavItemProps extends LayoutProps, Omit<React.ComponentProps<'button'>, 'width' | 'ref'> {
  active?: boolean;
  icon?: IconName;
  // Content before the label, such as a section number. Takes the accent color when active.
  leading?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  // Content at the right end, such as a count or marker icons
  trailing?: React.ReactNode;
  // 1 is a main entry, 2 a sub-entry under it
  level?: 1 | 2;
  // Where the active marker sits: the start edge, or under the item as in a tab bar
  indicator?: 'start' | 'bottom';
  // A number before the label, in the place of leading content
  number?: number;
  // Shows the active entry with its bold label only, without the fill and the marker, while one of its sub-entries is the current one
  quietActive?: boolean;
  // Long labels wrap instead of being cut
  wrap?: boolean;
  // Aligns the leading content with the first line of a wrapped label
  leadingAlign?: 'center' | 'start';
  // The entry's sub-entries are shown under it
  expanded?: boolean;
  // The weight of a main entry's label: bold, or regular for a calmer list
  labelWeight?: 'bold' | 'regular';
  // Buttons over the right end of the entry, outside its clickable area, that show on hover and keyboard focus
  actions?: React.ReactNode;
  // Shown in the entry's frame in place of its content, such as a rename input. The entry is then not clickable.
  editor?: React.ReactNode;
}

/** One entry in a navigation list. */
const NavItem: React.FC<NavItemProps> = ({ active = false, icon, leading, description, meta, trailing, level = 1, indicator = 'start', number, quietActive = false, wrap = false, leadingAlign = 'center', expanded = false, labelWeight = 'bold', actions, editor, className, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  const { mobileList } = useNavListStyle();
  // The mobile list look applies to entries without actions or an editor
  const listView = mobileList && actions === undefined && editor === undefined;
  // The entry shows the fill and the marker; an active entry in the mobile list view or with quietActive does not
  const marked = active && !quietActive && !listView;
  const leadingContent = number !== undefined ? <span className="nav-item__number t-ui">{number}</span> : leading;
  const stacked = Boolean(description || meta);
  const typography = level === 2 ? 't-ui-plain' : labelWeight === 'regular' ? 't-hint' : 't-ui';

  const classes = cx('nav-item', `nav-item--level-${level}`, `nav-item--indicator-${indicator}`, marked && 'nav-item--active', active && !listView && 'nav-item--current',
    wrap && 'nav-item--wrap', leadingAlign === 'start' && 'nav-item--leading-start', listView && 'nav-item--mobile-list', typography);

  if (editor !== undefined) {
    return <div className={cx(classes, className)} style={style}>{editor}</div>;
  }

  const entry = (
    <button
      type="button"
      className={cx(classes, actions === undefined && className)}
      style={actions === undefined ? style : undefined}
      aria-current={active ? 'page' : undefined}
      {...rest}
    >
      {icon && <Icon name={icon} color={active ? 'inherit' : 'secondary'} className="nav-item__icon" />}
      {leadingContent && <span className="nav-item__leading">{leadingContent}</span>}
      <span className={cx('nav-item__text', stacked && 'nav-item__text--stacked')}>
        <span className="nav-item__label">{children}</span>
        {description && <span className="nav-item__description t-caption">{description}</span>}
        {meta && <span className="nav-item__meta t-meta">{meta}</span>}
      </span>
      {trailing && <span className="nav-item__trailing">{trailing}</span>}
      {listView && level === 1 && <Icon name="chevronRight" color="muted" rotate={expanded ? 90 : 0} className="nav-item__chevron" />}
    </button>
  );

  if (actions === undefined) return entry;

  return (
    <div className={cx('nav-item-group', className)} style={style}>
      {entry}
      <span className="nav-item__actions">{actions}</span>
    </div>
  );
};

interface NavSubListProps {
  children?: React.ReactNode;
}

/** The sub-entries of an open navigation entry, on a thin rail under its number. */
export const NavSubList: React.FC<NavSubListProps> = ({ children }) => (
  <ol className="nav-sublist">{children}</ol>
);

export default NavItem;
