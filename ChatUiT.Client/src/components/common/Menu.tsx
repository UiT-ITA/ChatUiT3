import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useDismiss from '../../hooks/useDismiss';
import { Icon, type IconName } from './Icon';
import { floatingPanelClass, type PanelWidth } from './floatingPanel';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
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
  const [point, setPoint] = useState(anchorPoint);
  useDismiss(ref, floating && onClose !== undefined, () => onClose?.(), { escape: closeOnEscape, outsideClick: closeOnOutsideClick });

  const anchorX = anchorPoint?.x;
  const anchorY = anchorPoint?.y;

  // Moves a menu opened at a point back inside the viewport
  useLayoutEffect(() => {
    if (anchorX === undefined || anchorY === undefined || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const margin = 8;
    setPoint({
      x: Math.max(margin, Math.min(anchorX, window.innerWidth - width - margin)),
      y: Math.max(margin, Math.min(anchorY, window.innerHeight - height - margin)),
    });
  }, [anchorX, anchorY]);

  const style: React.CSSProperties | undefined = point
    ? { position: 'fixed', left: point.x, top: point.y, zIndex: 1000, ...layout }
    : layout;

  const menu = (
    <div ref={ref} role="menu" className={cx('menu', floating && floatingPanelClass(panelWidth), className)} style={style} {...rest}>
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
    className={cx('menu__item', 't-ui-plain', danger && 'menu__item--danger', selected && 'menu__item--selected', className)}
    onClick={(e) => { onClick?.(e); onSelect?.(e); }}
    {...rest}
  >
    {icon && <Icon name={icon} size="medium" className="menu__item-icon" />}
    <span className="menu__item-label">{children}</span>
    {shortcut && <kbd className="menu__item-shortcut t-meta">{shortcut}</kbd>}
    {selected && <Icon name="check" size="small" className="menu__item-check" />}
  </button>
);

/** A line between groups of menu items. */
export const MenuDivider: React.FC = () => <div role="separator" className="menu__divider" />;

/** A heading above a group of menu items. */
export const MenuHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="menu__heading t-overline">{children}</div>
);
