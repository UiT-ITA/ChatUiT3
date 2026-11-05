import React from 'react';
import { cx, flexValue, space, splitLayoutProps, type Align, type LayoutProps, type Space } from './layout';
import { scrollFadeClass, type ScrollFadeSize } from './scrollFade';

interface ScrollerProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // The direction the content scrolls in
  axis?: 'x' | 'y';
  // Fades the edges while there is more content beyond them
  fade?: boolean;
  // How far the faded edges reach
  fadeSize?: ScrollFadeSize;
  // A sideways row without a scrollbar that snaps each item to the start edge
  snap?: boolean;
  // Lays the children out in a flex line along the axis with this gap
  gap?: Space;
  // Cross-axis alignment of the children when gap is set
  align?: Align;
  as?: React.ElementType;
  ref?: React.Ref<HTMLElement>;
}

/** A scroll area, with optional edge fades and snapping. */
const Scroller: React.FC<ScrollerProps> = ({ axis = 'y', fade = true, fadeSize = 'default', snap = false, gap, align, as: Element = 'div', className, ...props }) => {
  const [layout, rest] = splitLayoutProps(props);
  const style = gap
    ? { display: 'flex', flexDirection: axis === 'x' ? 'row' as const : 'column' as const, gap: space(gap), alignItems: align ? flexValue(align) : undefined, ...layout }
    : layout;
  return <Element className={cx(snap && 'h-scroller', fade && scrollFadeClass(axis, fadeSize), className)} style={style} {...rest} />;
};

export default Scroller;
