import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './ActionBar.css';

type ActionElement = React.ReactElement<{ className?: string }>;

interface ActionBarProps extends LayoutProps {
  // Draws a line under the actions
  divided?: boolean;
  // On narrow screens the buttons share the row and a primary button takes the full width
  fillOnMobile?: boolean;
  // An action placed apart at the far end of the row
  end?: ActionElement;
  className?: string;
  children?: React.ReactNode;
}

/** A wrapping row of action buttons. */
const ActionBar: React.FC<ActionBarProps> = ({ divided = false, fillOnMobile = false, end, className, children, ...props }) => {
  const [style] = splitLayoutProps(props);
  return (
    <div className={cx('action-bar', divided && 'action-bar--divided', fillOnMobile && 'action-bar--fill-mobile', className)} style={style}>
      {children}
      {end && React.cloneElement(end, { className: cx(end.props.className, 'action-bar__end') })}
    </div>
  );
};

export default ActionBar;
