import { cx } from './layout';
import './ProgressRing.css';

// The circle's radius in the 20 by 20 viewBox, and its length
const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A small circle that fills clockwise with a fraction from 0 to 1, in secondary text, warning or danger colour. */
export default function ProgressRing({ fraction, state = 'normal' }: { fraction: number; state?: 'normal' | 'warn' | 'danger' }) {
  const filled = Math.min(Math.max(fraction, 0), 1) * CIRCUMFERENCE;
  return (
    <svg className={cx('progress-ring', `progress-ring--${state}`)} viewBox="0 0 20 20" strokeWidth={2.5} aria-hidden="true">
      <circle cx={10} cy={10} r={RADIUS} />
      {filled > 0 && <circle cx={10} cy={10} r={RADIUS} strokeDasharray={`${filled} ${CIRCUMFERENCE}`} transform="rotate(-90 10 10)" />}
    </svg>
  );
}
