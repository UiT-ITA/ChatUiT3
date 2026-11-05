import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import useDismiss from '../../hooks/useDismiss';
import { Icon, type IconName } from './Icon';
import { floatingPanelClass, type PanelWidth } from './floatingPanel';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import { SELECTED_MARK_CLASS } from './selectedMark';
import './Menu.css';

interface MenuProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  // Draws the menu as its own floating panel. Leave off inside a Popover, which has one.
  floating?: boolean;
  // Floating only: the viewport point the menu opens at, as for a context menu
  anchorPoint?: { x: number; y: number };
  // Floating only: called on a click outside the menu or on Escape
  onClose?: () => void;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  panelWidth?: PanelWidth;
}

/** A list of MenuItem actions. */
export const Menu: React.FC<MenuProps> = ({ floating = false, anchorPoint, onClose, closeOnEscape = true, closeOnOutsideClick = true, panelWidth = 'small', className, children, ...props }) => {
  const [layout, rest] = splitLayoutProps(props);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, floating && onClose !== undefined, () => onClose?.(), { escape: closeOnEscape, outsideClick: closeOnOutsideClick });

  const style = anchorPoint
    ? { '--menu-x': `${anchorPoint.x}px`, '--menu-y': `${anchorPoint.y}px`, ...layout } as React.CSSProperties
    : layout;

  const menu = (
    <div ref={ref} role="menu" className={cx('menu', anchorPoint && 'menu--at-point', floating && floatingPanelClass(panelWidth), className)} style={style} {...rest}>
      {children}
    </div>
  );

  return anchorPoint ? createPortal(menu, document.body) : menu;
};

interface MenuItemProps extends Omit<React.ComponentProps<'button'>, 'onSelect' | 'type'> {
  icon?: IconName;
  danger?: boolean;
  // Makes the item a checkable option and shows a check mark when true
  selected?: boolean;
  // Key hint shown at the right end, such as "Ctrl+K"
  shortcut?: string;
  onSelect?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/** One action in a Menu. */
export const MenuItem: React.FC<MenuItemProps> = ({ icon, danger = false, selected, shortcut, onSelect, onClick, className, children, ...rest }) => (
  <button
    type="button"
    role={selected === undefined ? 'menuitem' : 'menuitemcheckbox'}
    aria-checked={selected}
    className={cx('menu__item', 't-ui-plain', danger && 'menu__item--danger', selected && 'menu__item--selected', rest['aria-current'] === 'page' && SELECTED_MARK_CLASS, className)}
    onClick={(e) => { onClick?.(e); onSelect?.(e); }}
    {...rest}
  >
    {icon && <Icon name={icon} size="sm" className="menu__item-icon" />}
    <span className="menu__item-label">{children}</span>
    {shortcut && <kbd className="menu__item-shortcut t-meta">{shortcut}</kbd>}
    {selected && <Icon name="check" size="sm" className="menu__item-check" />}
  </button>
);

/** A line between groups of menu items. */
export const MenuDivider: React.FC = () => <div role="separator" className="menu__divider" />;

/** A heading above a group of menu items. */
export const MenuHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="menu__heading t-overline">{children}</div>
);
