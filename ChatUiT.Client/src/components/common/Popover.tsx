import React, { useEffect, useRef, useState } from 'react';
import useDismiss from '../../hooks/useDismiss';
import { floatingPanelClass, type PanelWidth } from './floatingPanel';
import { cx, space, splitLayoutProps, type LayoutProps, type Space } from './layout';
import './Popover.css';

type Side = 'top' | 'bottom' | 'left' | 'right';
export type PopoverPlacement = Side | `${Side}-start` | `${Side}-end`;

type TriggerProps = React.HTMLAttributes<HTMLElement> & { 'aria-expanded'?: boolean; 'aria-haspopup'?: boolean | 'menu' | 'dialog' };

export interface PopoverProps extends LayoutProps {
  // The element that opens the panel, normally a Button or IconButton
  trigger: React.ReactElement<TriggerProps>;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  placement?: PopoverPlacement;
  // Gap between the anchor and the panel
  offset?: Space;
  // What the panel lines up with: the trigger, or the nearest positioned ancestor
  anchor?: 'trigger' | 'parent';
  openOn?: 'click' | 'hover';
  // Hover only: how long the panel stays after the pointer leaves, in ms
  hoverCloseDelay?: number;
  panelWidth?: PanelWidth;
  title?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** A trigger with a floating panel. Closes on a click outside or on Escape. */
const Popover: React.FC<PopoverProps> = ({
  trigger,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  closeOnEscape = true,
  closeOnOutsideClick = true,
  placement = 'bottom-start',
  offset = 'sm',
  anchor = 'trigger',
  openOn = 'click',
  hoverCloseDelay = 150,
  panelWidth = 'auto',
  title,
  disabled = false,
  className,
  children,
  ...props
}) => {
  const [layout] = splitLayoutProps(props);
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);
  const open = controlledOpen ?? ownOpen;
  const visible = !disabled && (open || hovered);

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  useDismiss(ref, visible, () => { setHovered(false); setOpen(false); }, { escape: closeOnEscape, outsideClick: closeOnOutsideClick });
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const hoverHandlers = openOn === 'hover' ? {
    onMouseEnter: () => { window.clearTimeout(closeTimer.current); setHovered(true); },
    onMouseLeave: () => { closeTimer.current = window.setTimeout(() => setHovered(false), hoverCloseDelay); },
  } : {};

  const [side, align = 'center'] = placement.split('-') as [Side, 'start' | 'end' | 'center' | undefined];

  const triggerElement = React.cloneElement(trigger, {
    'aria-expanded': visible,
    'aria-haspopup': true,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      trigger.props.onClick?.(event);
      if (!disabled) setOpen(!open);
    },
  });

  return (
    <div
      ref={ref}
      className={cx('popover', anchor === 'parent' && 'popover--anchor-parent', className)}
      style={{ ...layout, ['--popover-offset' as string]: space(offset) }}
      {...hoverHandlers}
    >
      {triggerElement}
      {visible && (
        <div className={cx('popover__panel', `popover__panel--${side}`, `popover__panel--align-${align}`, panelWidth === 'trigger' && 'popover__panel--match-trigger', floatingPanelClass(panelWidth))}>
          {title && <div className="popover__title t-overline">{title}</div>}
          {children}
        </div>
      )}
    </div>
  );
};

/** The padded content area of a Popover. */
export const PopoverBody: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('popover__body', className)}>{children}</div>
);

export default Popover;
