import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import { dataToneClass, type DataTone } from './dataTone';
import type { MeterState } from './ProgressBar';
import './Legend.css';

interface LegendProps extends LayoutProps {
  children?: React.ReactNode;
  className?: string;
}

/** A list of LegendItem rows. */
export const Legend: React.FC<LegendProps> = ({ className, children, ...props }) => {
  const [style] = splitLayoutProps(props);
  return <ul className={cx('legend', className)} style={style}>{children}</ul>;
};

interface LegendItemProps {
  tone: DataTone;
  label: React.ReactNode;
  value: React.ReactNode;
  // A share column after the value. Without it the label wraps.
  share?: React.ReactNode;
  // Colour of the value: default, warning or danger
  state?: MeterState;
}

/** One row of a Legend: a colour swatch, a label, a value and an optional share. */
export const LegendItem: React.FC<LegendItemProps> = ({ tone, label, value, share, state = 'normal' }) => (
  <li className={cx('legend__row', share === undefined && 'legend__row--wide', 't-hint')}>
    <span className={cx('legend__swatch', dataToneClass(tone))} />
    <span className="legend__label">{label}</span>
    <span className={cx('legend__value', state !== 'normal' && `legend__value--${state}`)}>{value}</span>
    {share !== undefined && <span className="legend__share">{share}</span>}
  </li>
);
