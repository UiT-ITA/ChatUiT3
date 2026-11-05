import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import useDismiss from '../../hooks/useDismiss';
import { floatingPanelClass, type PanelWidth } from './floatingPanel';
import { cx, space, splitLayoutProps, type LayoutProps, type Space } from './layout';
import './Popover.css';

type Side = 'top' | 'bottom' | 'left' | 'right';
export type PopoverPlacement = Side | `${Side}-start` | `${Side}-end`;

interface PopoverGroupValue {
  // The popover in the group that was opened with a click
  pinnedId: string | undefined;
  setPinnedId: (id: string | undefined) => void;
}

const PopoverGroupContext = createContext<PopoverGroupValue | null>(null);

/** Popovers inside open one at a time: while one is opened with a click, hovering the others does not open them. */
export const PopoverGroup: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [pinnedId, setPinnedId] = useState<string | undefined>(undefined);
  return <PopoverGroupContext.Provider value={{ pinnedId, setPinnedId }}>{children}</PopoverGroupContext.Provider>;
};

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
  // The panel content, or a function that gets a function that closes the panel
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
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
  const id = useId();
  const group = useContext(PopoverGroupContext);
  const otherPinned = group?.pinnedId !== undefined && group.pinnedId !== id;
  const visible = !disabled && (open || (hovered && !otherPinned));

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  const close = () => { setHovered(false); setOpen(false); };

  useDismiss(ref, visible, close, { escape: closeOnEscape, outsideClick: closeOnOutsideClick });
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const setPinnedId = group?.setPinnedId;
  useEffect(() => {
    if (!setPinnedId) return;
    if (open) {
      setPinnedId(id);
      return () => setPinnedId(undefined);
    }
  }, [open, id, setPinnedId]);

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
          <PopoverGroupContext.Provider value={null}>
            {typeof children === 'function' ? children(close) : children}
          </PopoverGroupContext.Provider>
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
