import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './CardGrid.css';

interface CardGridProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  // Each Card spans this many grid rows, and the rows of the cards line up across the grid row
  cardRows?: number;
  // A fixed number of equal columns, in place of columns of at least the minimum width
  columns?: number;
  ref?: React.Ref<HTMLDivElement>;
}

/** Cards in columns of at least a minimum width, at most three to a row. */
export const CardGrid: React.FC<CardGridProps> = ({ cardRows, columns, className, children, ...props }) => {
  const [layout, rest] = splitLayoutProps(props);
  const style = {
    ...layout,
    ...(cardRows ? { ['--card-grid-rows' as string]: cardRows } : {}),
    ...(columns ? { ['--card-grid-columns' as string]: columns } : {}),
  };
  return (
    <div className={cx('card-grid', cardRows && 'card-grid--subgrid', columns && 'card-grid--fixed-columns', className)} style={style} {...rest}>
      {children}
    </div>
  );
};
