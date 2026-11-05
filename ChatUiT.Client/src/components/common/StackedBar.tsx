import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import { dataToneClass, type DataTone } from './dataTone';
import './StackedBar.css';

interface StackedBarProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  // With 'absolute', a value is the share of the bar from 0 to 1. With 'relative', the segments split the whole bar by their values, with a gap between them.
  segments: { key: string; value: number; tone: DataTone }[];
  scale?: 'absolute' | 'relative';
}

/** A thin rounded bar made of coloured segments. */
const StackedBar: React.FC<StackedBarProps> = ({ segments, scale = 'absolute', className, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  return (
    <div className={cx('stacked-bar', `stacked-bar--${scale}`, className)} style={style} {...rest}>
      {segments.map(({ key, value, tone }) => (
        <div key={key} className={dataToneClass(tone)} style={scale === 'absolute' ? { width: `${Math.min(100, value * 100)}%` } : { flexGrow: value }} />
      ))}
    </div>
  );
};

export default StackedBar;
