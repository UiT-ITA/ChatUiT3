import React from 'react';
import './StickyActionBar.css';

/** A bar of actions, aligned to the end, that sticks to the bottom of the scrolling page. */
const StickyActionBar: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="sticky-action-bar">{children}</div>
);

export default StickyActionBar;
