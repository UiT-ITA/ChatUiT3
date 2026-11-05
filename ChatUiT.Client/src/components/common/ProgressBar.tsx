import React from 'react';
import { cx } from './layout';
import './ProgressBar.css';

// How close a measured value is to its limit: within it, near it, or at or over it
export type MeterState = 'normal' | 'warn' | 'danger';

interface ProgressBarProps {
  value: number;
  max: number;
  // The fill colour: accent, warning or danger
  state?: MeterState;
  className?: string;
}

/** A full-width bar, exposed as a meter, that fills with value out of max. */
const ProgressBar: React.FC<ProgressBarProps> = ({ value, max, state = 'normal', className }) => (
  <div className={cx('progress-bar', state !== 'normal' && `progress-bar--${state}`, className)} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
    <div className="progress-bar__fill" style={{ width: `${Math.min(100, max > 0 ? (value / max) * 100 : 100)}%` }} />
  </div>
);

export default ProgressBar;
