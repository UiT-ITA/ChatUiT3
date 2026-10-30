import React from 'react';
import { Icon, type IconName } from './Icon';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Badge.css';

interface BadgeProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  // 'outline' draws a frame, 'solid' fills with the tone's color
  variant?: 'outline' | 'solid';
  tone?: 'neutral' | 'accent' | 'warning' | 'danger';
  size?: 'small' | 'medium';
  icon?: IconName;
}

/** A small status label, such as "Not available yet". The children are its text. */
const Badge: React.FC<BadgeProps> = ({ variant = 'outline', tone = 'neutral', size = 'small', icon, className, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  return (
    <span
      className={cx('badge', `badge--${variant}`, `badge--${tone}`, `badge--${size}`, size === 'small' ? 't-meta' : 't-caption-strong', className)}
      style={style}
      {...rest}
    >
      {icon && <Icon name={icon} size="small" />}
      {children}
    </span>
  );
};

export default Badge;
