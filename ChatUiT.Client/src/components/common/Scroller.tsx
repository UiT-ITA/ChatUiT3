import React from 'react';
import { cx, flexValue, space, splitLayoutProps, type Align, type LayoutProps, type Space } from './layout';
import { scrollFadeClass } from './scrollFade';

interface ScrollerProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // The gap between the children
  gap: Space;
  // Cross-axis alignment of the children
  align?: Align;
  as?: React.ElementType;
}

/** A row that scrolls sideways without a scrollbar, snaps each item to the start edge and fades its edges while there is more content beyond them. */
const Scroller: React.FC<ScrollerProps> = ({ gap, align, as: Element = 'div', className, ...props }) => {
  const [layout, rest] = splitLayoutProps(props);
  const style = { display: 'flex', flexDirection: 'row' as const, gap: space(gap), alignItems: align ? flexValue(align) : undefined, ...layout };
  return <Element className={cx('h-scroller', scrollFadeClass('x'), className)} style={style} {...rest} />;
};

export default Scroller;
