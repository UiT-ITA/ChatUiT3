import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import type { TextVariant } from './Text';
import './Table.css';

interface TableProps extends LayoutProps {
  columns: React.ReactNode[];
  rows: { key: string; cells: React.ReactNode[] }[];
  // Typography roles of the header cells and of the body cells
  headVariant?: TextVariant;
  cellVariant?: TextVariant;
  className?: string;
}

/** A table with a header row and text rows. */
const Table: React.FC<TableProps> = ({ columns, rows, headVariant = 'label', cellVariant = 'table', className, ...props }) => {
  const [style] = splitLayoutProps(props);
  return (
    <table className={cx('table', className)} style={style}>
      <thead>
        <tr>
          {columns.map((column, index) => <th key={index} className={cx('table__cell', 'table__cell--head', `t-${headVariant}`)}>{column}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.key}>
            {row.cells.map((cell, index) => <td key={index} className={cx('table__cell', `t-${cellVariant}`)}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Table;
