import React from 'react';
import { cx } from './layout';
import './PanelSection.css';

interface PanelSectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  // An action at the right end of the heading, such as an add button
  action?: React.ReactNode;
  // Content between the heading and the panel, such as a status line
  between?: React.ReactNode;
  // Fades the heading and the panel, for a section that is not available
  dimmed?: boolean;
  'aria-label'?: string;
  // The items in the framed panel
  children?: React.ReactNode;
}

/** A titled section with an optional action, and its items in a framed panel below. */
const PanelSection: React.FC<PanelSectionProps> = ({ title, description, action, between, dimmed = false, 'aria-label': ariaLabel, children }) => (
  <section className={cx('panel-section', dimmed && 'panel-section--dimmed')} aria-label={ariaLabel}>
    <div className="panel-section__header">
      <div className="panel-section__heading">
        <h3 className="panel-section__title t-body-strong">{title}</h3>
        {description !== undefined && <p className="panel-section__description t-ui-plain">{description}</p>}
      </div>
      {action}
    </div>
    {between}
    <div className="panel-section__items">{children}</div>
  </section>
);

export default PanelSection;
