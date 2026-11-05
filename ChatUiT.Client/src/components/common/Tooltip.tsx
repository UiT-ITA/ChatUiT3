import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './layout';
import './Tooltip.css';

interface TooltipProps {
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'right';
  align?: 'start' | 'end';
  width?: 'auto' | 'small' | 'medium';
  // Makes the wrapped content reachable with Tab, for content that is not focusable itself.
  // Clicks and Enter/Space on it then stay inside the tooltip.
  focusable?: boolean;
  // Wraps block content, such as a paragraph, in a block element that fills the width
  block?: boolean;
  className?: string;
  children: React.ReactNode;
}

type Position = { left?: number; right?: number; top?: number; bottom?: number };

/** Shows a short text near its children on hover and keyboard focus. */
const Tooltip: React.FC<TooltipProps> = ({ content, placement = 'top', align = 'end', width = 'medium', focusable = false, block = false, className, children }) => {
  const [position, setPosition] = useState<Position | null>(null);

  const show = (event: React.SyntheticEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (placement === 'right') {
      setPosition({ left: rect.right, top: rect.top + rect.height / 2 });
      return;
    }
    setPosition({
      ...(placement === 'top' ? { bottom: window.innerHeight - rect.top } : { top: rect.bottom }),
      ...(align === 'end' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    });
  };
  const hide = () => setPosition(null);
  // Shows on hover from a mouse or a pen, not on a touch
  const showOnHover = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') show(event);
  };
  // Shows on keyboard focus, the focus that matches :focus-visible
  const showOnKeyboardFocus = (event: React.FocusEvent<HTMLElement>) => {
    if (event.target.matches(':focus-visible')) show(event);
  };

  const Anchor = block ? 'div' : 'span';

  return (
    <Anchor
      className={cx('tooltip-anchor', block && 'tooltip-anchor--block', className)}
      tabIndex={focusable ? 0 : undefined}
      onPointerEnter={showOnHover}
      onPointerLeave={hide}
      onFocus={showOnKeyboardFocus}
      onBlur={hide}
      onClick={focusable ? (event) => event.stopPropagation() : undefined}
      onKeyDown={focusable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
        }
      } : undefined}
    >
      {children}
      {position && createPortal(
        <div role="tooltip" className={cx('tooltip', `tooltip--${width}`, `tooltip--${placement}`, 't-caption')} style={position}>
          {content}
        </div>,
        document.body,
      )}
    </Anchor>
  );
};

export default Tooltip;
