import React from 'react';
import { Icon, type IconName } from './Icon';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Alert.css';

interface AlertProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLElement>, 'color' | 'title'> {
  tone?: 'note' | 'tip' | 'warning' | 'danger';
  title?: React.ReactNode;
  icon?: IconName;
}

/** A highlighted note in the flow of a page. The children are its body. */
const Alert: React.FC<AlertProps> = ({ tone = 'note', title, icon, className, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  return (
    <aside className={cx('alert', `alert--${tone}`, className)} style={style} {...rest}>
      {(title || icon) && (
        <div className="alert__title t-caption-strong">
          {icon && <Icon name={icon} size="small" />}
          {title}
        </div>
      )}
      <div className="alert__body t-ui-plain">{children}</div>
    </aside>
  );
};

export default Alert;
