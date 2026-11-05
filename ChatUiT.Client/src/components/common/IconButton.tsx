import React from 'react';
import { Icon, type IconName, type IconSize } from './Icon';
import { ButtonRoot, ButtonSpinner, type ButtonBaseProps } from './Button';
import { BUTTON_ICON_SIZE } from './buttonIconSize';
import { cx } from './layout';
import Tooltip from './Tooltip';

export interface IconButtonProps extends Omit<ButtonBaseProps, 'children'> {
  // An icon name, or a custom graphic such as a progress ring or badge
  icon: IconName | React.ReactElement;
  // Size of a named icon. Defaults to the size that matches the button.
  iconSize?: IconSize;
  // Accessible name, also shown as the tooltip
  label: string;
  // Marks the button as pressed or as the current item
  active?: boolean;
  // The fill of an active button: 'soft' is the selection tint, 'strong' an accent tint, 'none' only the main text colour
  activeFill?: 'soft' | 'strong' | 'none';
  shape?: 'square' | 'round';
  // Shows the label in a tooltip on hover and keyboard focus. On by default.
  tooltip?: boolean;
  // Where the tooltip shows, and which edge of the button a tooltip above or below lines up with
  tooltipPlacement?: 'top' | 'bottom' | 'right';
  tooltipAlign?: 'start' | 'end';
  // Content after the icon, such as a count badge
  children?: React.ReactNode;
}

/** The app's icon-only button. */
const IconButton: React.FC<IconButtonProps> = ({ icon, iconSize, label, variant = 'ghost', size = 'medium', active = false, activeFill = 'soft', shape = 'square', tooltip = true, tooltipPlacement, tooltipAlign, loading = false, className, children, ...rest }) => {
  const button = (
    <ButtonRoot
      classes={cx('button', `button--${variant}`, `button--${size}`, 'button--icon-only', shape === 'round' && 'button--round', active && 'button--active', activeFill !== 'soft' && `button--active-fill-${activeFill}`, className)}
      aria-label={label}
      loading={loading}
      {...rest}
    >
      {loading ? <ButtonSpinner /> : typeof icon === 'string' ? <Icon name={icon} size={iconSize ?? BUTTON_ICON_SIZE[size]} /> : icon}
      {children}
    </ButtonRoot>
  );
  return tooltip && label ? (
    <Tooltip content={label} placement={tooltipPlacement} align={tooltipAlign} width="auto">
      {button}
    </Tooltip>
  ) : button;
};

export default IconButton;
