import React from 'react';
import { Icon, type IconName, type IconSize } from './Icon';
import { ButtonRoot, ButtonSpinner, type ButtonBaseProps } from './Button';
import { BUTTON_ICON_SIZE } from './buttonIconSize';
import { cx } from './layout';

export interface IconButtonProps extends Omit<ButtonBaseProps, 'children'> {
  // An icon name, or a custom graphic such as a progress ring or badge
  icon: IconName | React.ReactElement;
  // Size of a named icon. Defaults to the size that matches the button.
  iconSize?: IconSize;
  // Accessible name, also shown as the tooltip
  label: string;
  // Marks the button as pressed or as the current item
  active?: boolean;
  shape?: 'square' | 'round';
  // Shows the label as a tooltip. On by default.
  tooltip?: boolean;
  // Content after the icon, such as a count badge
  children?: React.ReactNode;
}

/** The app's icon-only button. */
const IconButton: React.FC<IconButtonProps> = ({ icon, iconSize, label, variant = 'ghost', size = 'medium', active = false, shape = 'square', tooltip = true, loading = false, className, title, children, ...rest }) => (
  <ButtonRoot
    classes={cx('button', `button--${variant}`, `button--${size}`, 'button--icon-only', shape === 'round' && 'button--round', active && 'button--active', className)}
    aria-label={label}
    title={title ?? (tooltip ? label : undefined)}
    loading={loading}
    {...rest}
  >
    {loading ? <ButtonSpinner /> : typeof icon === 'string' ? <Icon name={icon} size={iconSize ?? BUTTON_ICON_SIZE[size]} /> : icon}
    {children}
  </ButtonRoot>
);

export default IconButton;
