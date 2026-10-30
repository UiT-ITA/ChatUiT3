import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './layout';
import './Tooltip.css';

interface TooltipProps {
  content: React.ReactNode;
  placement?: 'top' | 'bottom';
  align?: 'start' | 'end';
  width?: 'auto' | 'small' | 'medium';
  // Makes the wrapped content reachable with Tab, for content that is not focusable itself.
  // Clicks and Enter/Space on it then stay inside the tooltip.
  focusable?: boolean;
  className?: string;
  children: React.ReactNode;
}

type Position = { left?: number; right?: number; top?: number; bottom?: number };

const GAP = 8;

/** Shows a short text near its children on hover and keyboard focus. */
const Tooltip: React.FC<TooltipProps> = ({ content, placement = 'top', align = 'end', width = 'medium', focusable = false, className, children }) => {
  const [position, setPosition] = useState<Position | null>(null);

  const show = (event: React.SyntheticEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      ...(placement === 'top' ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      ...(align === 'end' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    });
  };
  const hide = () => setPosition(null);

  return (
    <span
      className={cx('tooltip-anchor', className)}
      tabIndex={focusable ? 0 : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
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
        <div role="tooltip" className={cx('tooltip', `tooltip--${width}`, 't-caption')} style={position}>
          {content}
        </div>,
        document.body,
      )}
    </span>
  );
};

export default Tooltip;
