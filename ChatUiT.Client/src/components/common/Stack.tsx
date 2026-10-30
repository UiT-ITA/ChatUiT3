import React from 'react';
import { cx, flexValue, space, splitLayoutProps, type Align, type Justify, type LayoutProps, type Space } from './layout';

interface StackProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  direction?: 'row' | 'column';
  gap?: Space;
  align?: Align;
  justify?: Justify;
  wrap?: boolean;
  // The element to render
  as?: React.ElementType;
}

/** Lays its children out in a row or a column with even gaps. */
const Stack: React.FC<StackProps> = ({ direction = 'column', gap = 'md', align, justify, wrap = false, as: Element = 'div', className, ...props }) => {
  const [layout, rest] = splitLayoutProps(props);
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    gap: space(gap),
    alignItems: align ? flexValue(align) : undefined,
    justifyContent: justify ? flexValue(justify) : undefined,
    flexWrap: wrap ? 'wrap' : undefined,
    minWidth: 0,
    ...layout,
  };
  return <Element className={cx('stack', className)} style={style} {...rest} />;
};

export default Stack;
