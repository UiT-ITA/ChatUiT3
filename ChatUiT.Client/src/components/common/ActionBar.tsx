import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './ActionBar.css';

interface ActionBarProps extends LayoutProps {
  // Draws a line under the actions
  divided?: boolean;
  // On narrow screens the buttons share the row and a primary button takes the full width
  fillOnMobile?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** A wrapping row of action buttons. */
const ActionBar: React.FC<ActionBarProps> = ({ divided = false, fillOnMobile = false, className, children, ...props }) => {
  const [style] = splitLayoutProps(props);
  return (
    <div className={cx('action-bar', divided && 'action-bar--divided', fillOnMobile && 'action-bar--fill-mobile', className)} style={style}>
      {children}
    </div>
  );
};

export default ActionBar;
