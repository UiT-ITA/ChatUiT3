import React from 'react';
import { cx } from './layout';
import './ZoomToggle.css';

interface ZoomToggleProps {
  zoomed: boolean;
  onToggle: () => void;
  // Accessible name
  label: string;
  // Tooltip hint
  hint?: string;
  children: React.ReactNode;
}

/** Wraps content that switches between fitted and full size when clicked or activated with Enter or Space. */
const ZoomToggle: React.FC<ZoomToggleProps> = ({ zoomed, onToggle, label, hint, children }) => (
  <div
    className={cx('zoom-toggle', zoomed && 'zoom-toggle--zoomed')}
    role="button"
    tabIndex={0}
    aria-pressed={zoomed}
    aria-label={label}
    title={hint}
    onClick={onToggle}
    onKeyDown={(e) => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onToggle();
      }
    }}
  >
    {children}
  </div>
);

export default ZoomToggle;
