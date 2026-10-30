import React from 'react';
import { cx, space, splitLayoutProps, type LayoutProps, type Space } from './layout';

interface GridProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // A fixed number of equal columns
  columns?: number;
  // Fits as many columns of at least this width as there is room for. Used when columns is not set.
  minColumnWidth?: string;
  gap?: Space;
  rowGap?: Space;
  columnGap?: Space;
  // The element to render
  as?: React.ElementType;
}

/** Lays its children out in columns. */
const Grid: React.FC<GridProps> = ({ columns, minColumnWidth = '12rem', gap = 'lg', rowGap, columnGap, as: Element = 'div', className, ...props }) => {
  const [layout, rest] = splitLayoutProps(props);
  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : `repeat(auto-fit, minmax(${minColumnWidth}, 1fr))`,
    rowGap: space(rowGap ?? gap),
    columnGap: space(columnGap ?? gap),
    ...layout,
  };
  return <Element className={cx('grid', className)} style={style} {...rest} />;
};

export default Grid;
