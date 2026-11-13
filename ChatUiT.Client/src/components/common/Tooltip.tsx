import React, { useLayoutEffect, useRef, useState } from 'react';
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

type Side = 'top' | 'bottom' | 'right' | 'left';
type Position = { left?: number; right?: number; top?: number; bottom?: number };
// The side the tooltip shows on, and how far it is moved along that side to stay inside the window
type Fit = { side: Side; shift: number };

/** Shows a short text near its children on hover and keyboard focus, flipped and moved to stay inside the window. */
const Tooltip: React.FC<TooltipProps> = ({ content, placement = 'top', align = 'end', width = 'medium', focusable = false, block = false, className, children }) => {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Measures the tooltip at its requested side, then picks the side and shift that keep it inside the window
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;
    const box = tooltip.getBoundingClientRect();
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;

    if (placement === 'right') {
      const gap = box.left - anchor.right;
      const side = box.right > viewWidth - gap && anchor.left - gap - box.width >= gap ? 'left' : 'right';
      setFit({ side, shift: shiftInto(box.top, box.bottom, viewHeight, gap) });
      return;
    }

    const gap = placement === 'top' ? anchor.top - box.bottom : box.top - anchor.bottom;
    let side: Side = placement;
    if (placement === 'top' && box.top < gap && anchor.bottom + gap + box.height <= viewHeight - gap) side = 'bottom';
    if (placement === 'bottom' && box.bottom > viewHeight - gap && anchor.top - gap - box.height >= gap) side = 'top';
    setFit({ side, shift: shiftInto(box.left, box.right, viewWidth, gap) });
  }, [anchor, placement]);

  const show = (event: React.SyntheticEvent<HTMLElement>) => {
    setFit(null);
    setAnchor(event.currentTarget.getBoundingClientRect());
  };
  const hide = () => {
    setAnchor(null);
    setFit(null);
  };

  const side = fit?.side ?? placement;
  const position = anchor && positionAt(anchor, side, align, fit?.shift ?? 0);
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
        <div ref={tooltipRef} role="tooltip" className={cx('tooltip', `tooltip--${width}`, `tooltip--${side}`, 't-caption')} style={position}>
          {content}
        </div>,
        document.body,
      )}
    </Anchor>
  );
};

/** The distance that moves the span from start to end inside 0 to limit, keeping gap to each edge. */
function shiftInto(start: number, end: number, limit: number, gap: number): number {
  if (start < gap) return gap - start;
  if (end > limit - gap) return Math.max(gap - start, limit - gap - end);
  return 0;
}

/** The fixed position of a tooltip on the given side of the anchor, moved by shift along that side. */
function positionAt(anchor: DOMRect, side: Side, align: 'start' | 'end', shift: number): Position {
  if (side === 'right' || side === 'left') {
    const top = anchor.top + anchor.height / 2 + shift;
    return side === 'right' ? { left: anchor.right, top } : { right: window.innerWidth - anchor.left, top };
  }
  return {
    ...(side === 'top' ? { bottom: window.innerHeight - anchor.top } : { top: anchor.bottom }),
    ...(align === 'end' ? { right: window.innerWidth - anchor.right - shift } : { left: anchor.left + shift }),
  };
}

export default Tooltip;
