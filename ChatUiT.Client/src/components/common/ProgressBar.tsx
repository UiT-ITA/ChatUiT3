import React from 'react';
import { Meter, MeterIndicator, MeterTrack } from '@ui-sdk/react/meter';
import { cx } from './layout';
import './ProgressBar.css';

// How close a measured value is to its limit: within it, near it, or at or over it
export type MeterState = 'normal' | 'warn' | 'danger';

interface ProgressBarProps {
  value: number;
  max: number;
  // The fill colour: accent, warning or danger
  state?: MeterState;
  // The id of the text that names the measurement
  'aria-labelledby'?: string;
  className?: string;
}

/** A full-width ui-sdk meter bar that fills with value out of max. */
const ProgressBar: React.FC<ProgressBarProps> = ({ value, max, state = 'normal', className, ...props }) => (
  <Meter value={value} max={max} className={cx('progress-bar', state !== 'normal' && `progress-bar--${state}`, className)} {...props}>
    <MeterTrack className="progress-bar__track">
      <MeterIndicator className="progress-bar__fill" />
    </MeterTrack>
  </Meter>
);

export default ProgressBar;
