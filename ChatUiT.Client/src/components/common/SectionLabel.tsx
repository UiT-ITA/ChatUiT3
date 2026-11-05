import React from 'react';
import './SectionLabel.css';

/** A label above a group of settings, with an optional hint line under it that says what the section sets. */
const SectionLabel: React.FC<{ hint?: React.ReactNode; children: React.ReactNode }> = ({ hint, children }) => (
  <div className="section-label">
    <div className="section-label__title t-overline">{children}</div>
    {hint && <p className="section-label__hint t-caption">{hint}</p>}
  </div>
);

export default SectionLabel;
