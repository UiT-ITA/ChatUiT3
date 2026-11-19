import React from 'react';
import { cx, flexValue, space, splitBoxProps, splitLayoutProps, type Align, type BoxProps, type Justify, type LayoutProps, type Space } from './layout';
import { scrollFadeClass } from './scrollFade';
import './Stack.css';

interface StackProps extends LayoutProps, BoxProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  direction?: 'row' | 'column';
  gap?: Space;
  // Separate gaps between rows and between columns of a wrapping row
  rowGap?: Space;
  columnGap?: Space;
  align?: Align;
  justify?: Justify;
  wrap?: boolean;
  // The gap on narrow screens, up to 50rem
  mobileGap?: Space;
  // Hides the stack and keeps its children mounted
  hidden?: boolean;
  // Fades the edges of a scrolling stack on this axis while there is more content beyond them
  fade?: 'x' | 'y';
  // The element to render
  as?: React.ElementType;
  ref?: React.Ref<HTMLElement>;
}

/** Lays its children out in a row or a column with even gaps. */
const Stack: React.FC<StackProps> = ({ direction = 'column', gap = 'md', rowGap, columnGap, align, justify, wrap = false, mobileGap, hidden = false, fade, as: Element = 'div', className, ...props }) => {
  const [box, boxRest] = splitBoxProps(props);
  const [layout, rest] = splitLayoutProps(boxRest);
  // A mobile gap is set as custom properties that Stack.css switches at the breakpoint
  const baseGap = mobileGap ? undefined : space(gap);
  const style: React.CSSProperties = {
    display: hidden ? 'none' : undefined,
    flexDirection: direction,
    rowGap: rowGap ? space(rowGap) : baseGap,
    columnGap: columnGap ? space(columnGap) : baseGap,
    alignItems: align && flexValue(align),
    justifyContent: justify && flexValue(justify),
    flexWrap: wrap ? 'wrap' : undefined,
    minWidth: 0,
    ...box,
    ...layout,
    ...(mobileGap && { '--stack-gap': space(gap), '--stack-gap-mobile': space(mobileGap) }),
  };
  return <Element className={cx('stack', mobileGap && 'stack--mobile-gap', fade && scrollFadeClass(fade), className)} style={style} {...rest} />;
};

export default Stack;
