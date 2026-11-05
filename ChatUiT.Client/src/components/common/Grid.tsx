import React from 'react';
import { cx, length, space, splitBoxProps, splitLayoutProps, type BoxProps, type LayoutProps, type SizeStep, type Space } from './layout';
import './Box.css';
import './Grid.css';

interface GridProps extends LayoutProps, BoxProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // A fixed number of equal columns
  columns?: number;
  // Fits as many columns of at least this width as there is room for. Used when columns is not set.
  minColumnWidth?: SizeStep;
  // Keeps empty column tracks when there are fewer items than fit in a row
  fill?: boolean;
  // Column counts on narrow (mobile, up to 50rem) and very narrow (up to 36rem) screens
  mobileColumns?: number;
  narrowColumns?: number;
  // Rows of equal height, on every screen or on wide (desktop) screens only
  equalRows?: 'always' | 'desktop';
  gap?: Space;
  rowGap?: Space;
  columnGap?: Space;
  // The element to render
  as?: React.ElementType;
}

const columnsTemplate = (count: number) => `repeat(${count}, minmax(0, 1fr))`;

/** Lays its children out in columns. */
const Grid: React.FC<GridProps> = ({ columns, minColumnWidth = 'xs', fill = false, mobileColumns, narrowColumns, equalRows, gap = 'lg', rowGap, columnGap, as: Element = 'div', className, ...props }) => {
  const [box, hideClass, boxRest] = splitBoxProps(props);
  const [layout, rest] = splitLayoutProps(boxRest);
  const template = columns ? columnsTemplate(columns) : `repeat(${fill ? 'auto-fill' : 'auto-fit'}, minmax(${length(minColumnWidth)}, 1fr))`;
  const responsive = Boolean(mobileColumns || narrowColumns);
  const style: React.CSSProperties = {
    display: 'grid',
    ...(responsive
      ? {
        '--grid-template': template,
        ...(mobileColumns ? { '--grid-template-mobile': columnsTemplate(mobileColumns) } : {}),
        ...(narrowColumns ? { '--grid-template-narrow': columnsTemplate(narrowColumns) } : {}),
      }
      : { gridTemplateColumns: template }),
    rowGap: space(rowGap ?? gap),
    columnGap: space(columnGap ?? gap),
    ...box,
    ...layout,
  };
  return <Element className={cx(responsive && 'grid--responsive', equalRows && `grid--equal-rows-${equalRows}`, hideClass, className)} style={style} {...rest} />;
};

export default Grid;
