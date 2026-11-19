import React from 'react';
import { cx, length, space, type SizeStep, type Space } from './layout';
import './Grid.css';

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  // A fixed number of equal columns
  columns?: number;
  // Fits as many columns of at least this width as there is room for. Used when columns is not set.
  minColumnWidth?: SizeStep;
  // Keeps empty column tracks when there are fewer items than fit in a row
  fill?: boolean;
  // The column count on very narrow screens, up to 36rem
  narrowColumns?: number;
  gap?: Space;
}

const columnsTemplate = (count: number) => `repeat(${count}, minmax(0, 1fr))`;

/** Lays its children out in columns. */
const Grid: React.FC<GridProps> = ({ columns, minColumnWidth = 'xs', fill = false, narrowColumns, gap = 'lg', className, style, ...rest }) => {
  const template = columns ? columnsTemplate(columns) : `repeat(${fill ? 'auto-fill' : 'auto-fit'}, minmax(${length(minColumnWidth)}, 1fr))`;
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    ...(narrowColumns
      ? { '--grid-template': template, '--grid-template-narrow': columnsTemplate(narrowColumns) }
      : { gridTemplateColumns: template }),
    gap: space(gap),
    ...style,
  };
  return <div className={cx(narrowColumns && 'grid--narrow-columns', className)} style={gridStyle} {...rest} />;
};

export default Grid;
