import React from 'react';
import { Icon, type IconName } from './Icon';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './PillButton.css';

interface PillButtonProps extends LayoutProps, Omit<React.ComponentProps<'button'>, 'type' | 'width'> {
  // A number after the label, in the muted meta style
  count?: React.ReactNode;
  // A small muted icon after the label and count
  endIcon?: IconName;
}

/** A framed, pill-shaped button for jumping to a section or picking a quick option. The children are its label. */
const PillButton: React.FC<PillButtonProps> = ({ count, endIcon, className, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  return (
    <button type="button" className={cx('pill-button', 't-caption-strong', className)} style={style} {...rest}>
      {children}
      {count !== undefined && <span className="pill-button__count t-meta">{count}</span>}
      {endIcon && <Icon name={endIcon} size="sm" className="pill-button__icon" />}
    </button>
  );
};

export default PillButton;
