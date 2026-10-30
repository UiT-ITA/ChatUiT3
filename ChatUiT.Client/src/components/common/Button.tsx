import React from 'react';
import { Icon, type IconName } from './Icon';
import { BUTTON_ICON_SIZE, type ButtonSize } from './buttonIconSize';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Button.css';

// 'inherit' is transparent and takes the text color of its container, for buttons inside chips and tags.
// 'dashed' is the add-a-new-item action at the end of a list.
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'subtle' | 'ghost' | 'inherit' | 'dashed';

/** Parameters Button and IconButton share. */
export interface ButtonBaseProps extends LayoutProps, Omit<React.ComponentProps<'button'>, 'type' | 'width'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Disables the button and shows a spinner
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  // Renders a link that looks like the button
  href?: string;
  target?: string;
}

/** Renders a button, or a link when href is set, with the shared button classes. */
export const ButtonRoot: React.FC<ButtonBaseProps & { classes: string }> = ({ classes, href, target, type = 'button', loading = false, disabled, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  if (href) {
    const anchorProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} style={style} href={disabled ? undefined : href} target={target} aria-disabled={disabled || undefined} {...anchorProps}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={classes} style={style} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {children}
    </button>
  );
};

export const ButtonSpinner: React.FC = () => <span className="button__spinner" aria-hidden="true" />;

export interface ButtonProps extends ButtonBaseProps {
  // An icon name, or a custom icon element such as a spinning Icon
  startIcon?: IconName | React.ReactElement;
  endIcon?: IconName | React.ReactElement;
  fullWidth?: boolean;
  // Where the content sits in a wide button
  justify?: 'start' | 'center';
  // Marks the button as pressed or as the current item
  active?: boolean;
  // Text color of the ghost, subtle and dashed variants
  tone?: 'default' | 'warning' | 'danger';
}

/** The app's text button. */
const renderIcon = (icon: IconName | React.ReactElement | undefined, size: ButtonSize) =>
  typeof icon === 'string' ? <Icon name={icon} size={BUTTON_ICON_SIZE[size]} /> : icon;

const Button: React.FC<ButtonProps> = ({ variant = 'secondary', size = 'medium', startIcon, endIcon, fullWidth = false, justify = 'center', tone = 'default', active = false, loading = false, className, children, ...rest }) => (
  <ButtonRoot
    classes={cx('button', `button--${variant}`, `button--${size}`, fullWidth && 'button--full-width', justify === 'start' && 'button--justify-start', active && 'button--active', tone !== 'default' && `button--tone-${tone}`, 't-ui', className)}
    loading={loading}
    {...rest}
  >
    {loading ? <ButtonSpinner /> : renderIcon(startIcon, size)}
    <span className="button__label">{children}</span>
    {renderIcon(endIcon, size)}
  </ButtonRoot>
);

export default Button;
