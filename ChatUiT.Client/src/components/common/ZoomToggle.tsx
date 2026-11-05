import React from 'react';
import { cx } from './layout';
import './ZoomToggle.css';

// The images and diagrams in the content, but not icons
const ZOOM_TARGET = 'svg:not(.icon), img';

interface ZoomToggleProps {
  zoomed: boolean;
  onToggle: () => void;
  // Tooltip hint
  hint?: string;
  children: React.ReactNode;
}

/** Wraps content whose image or diagram switches between fitted and full size when clicked. Clicks elsewhere in the content do nothing. */
const ZoomToggle: React.FC<ZoomToggleProps> = ({ zoomed, onToggle, hint, children }) => (
  <div
    className={cx('zoom-toggle', zoomed && 'zoom-toggle--zoomed')}
    title={hint}
    onClick={(e) => {
      if ((e.target as Element).closest(ZOOM_TARGET)) onToggle();
    }}
  >
    {children}
  </div>
);

export default ZoomToggle;
