import React from 'react';
import { cx, flexValue, length, space, splitBoxProps, splitLayoutProps, type Align, type BoxProps, type Justify, type LayoutProps, type Length, type Space } from './layout';
import { scrollFadeClass } from './scrollFade';
import './Stack.css';
import './Box.css';

interface StackProps extends LayoutProps, BoxProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  direction?: 'row' | 'column';
  gap?: Space;
  // Separate gaps between rows and between columns of a wrapping row
  rowGap?: Space;
  columnGap?: Space;
  align?: Align;
  justify?: Justify;
  wrap?: boolean;
  // Overrides on narrow screens, up to the breakpoint
  mobileDirection?: 'row' | 'column';
  mobileGap?: Space;
  mobileAlign?: Align;
  mobileMaxWidth?: Length;
  // The screen width up to which the mobile overrides apply: 'mobile' and 'compact' 50rem, 'narrow' 36rem
  breakpoint?: 'mobile' | 'compact' | 'narrow';
  // Renders as an inline flex container
  inline?: boolean;
  // Hides the stack and keeps its children mounted
  hidden?: boolean;
  // Fades the edges of a scrolling stack on this axis while there is more content beyond them
  fade?: 'x' | 'y';
  // The element to render
  as?: React.ElementType;
  ref?: React.Ref<HTMLElement>;
}

/** Lays its children out in a row or a column with even gaps. */
const Stack: React.FC<StackProps> = ({ direction = 'column', gap = 'md', rowGap, columnGap, align, justify, wrap = false, mobileDirection, mobileGap, mobileAlign, mobileMaxWidth, breakpoint = 'mobile', inline = false, hidden = false, fade, as: Element = 'div', className, ...props }) => {
  const [box, hideClass, boxRest] = splitBoxProps(props);
  const [layout, rest] = splitLayoutProps(boxRest);
  const responsive = Boolean(mobileDirection || mobileGap || mobileAlign || mobileMaxWidth);
  const alignValue = align ? flexValue(align) : 'normal';
  const baseGap = responsive ? undefined : space(gap);
  // The direction, gap, alignment and max width of a responsive stack, as custom properties that Stack.css switches at the breakpoint
  const responsiveStyle = {
    '--stack-direction': direction,
    '--stack-gap': space(gap),
    '--stack-align': alignValue,
    '--stack-direction-mobile': mobileDirection ?? direction,
    '--stack-gap-mobile': space(mobileGap ?? gap),
    '--stack-align-mobile': mobileAlign ? flexValue(mobileAlign) : alignValue,
    ...(mobileMaxWidth && { '--stack-max-width': layout?.maxWidth ?? 'none', '--stack-max-width-mobile': length(mobileMaxWidth), maxWidth: undefined }),
  };
  const style: React.CSSProperties = {
    display: hidden ? 'none' : undefined,
    flexDirection: responsive ? undefined : direction,
    rowGap: rowGap ? space(rowGap) : baseGap,
    columnGap: columnGap ? space(columnGap) : baseGap,
    alignItems: responsive || !align ? undefined : flexValue(align),
    justifyContent: justify && flexValue(justify),
    flexWrap: wrap ? 'wrap' : undefined,
    minWidth: 0,
    ...box,
    ...layout,
    ...(responsive && responsiveStyle),
  };
  return <Element className={cx('stack', inline && 'stack--inline', responsive && 'stack--responsive', responsive && breakpoint === 'narrow' && 'stack--narrow', mobileMaxWidth && 'stack--mobile-max-width', fade && scrollFadeClass(fade), hideClass, className)} style={style} {...rest} />;
};

export default Stack;
