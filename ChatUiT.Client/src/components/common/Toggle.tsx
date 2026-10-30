import React from 'react';
import { cx, splitLayoutProps, type LayoutProps, type Size } from './layout';
import './Toggle.css';

type NativeButtonProps = Omit<React.ComponentProps<'button'>, 'onChange' | 'type' | 'width'>;

export interface ToggleProps extends LayoutProps, NativeButtonProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  // Visible text next to the switch. Without it, give the switch an aria-label.
  label?: React.ReactNode;
  labelPosition?: 'start' | 'end';
  size?: Size;
  // Color of the switch when on
  tone?: 'accent' | 'critical';
}

/** The app's on/off switch. */
const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, labelPosition = 'start', size = 'medium', tone = 'accent', className, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cx('toggle', `toggle--${size}`, `toggle--${tone}`, checked && 'toggle--on', !label && className)}
      style={label ? undefined : style}
      onClick={() => onChange(!checked)}
      {...rest}
    >
      <span className="toggle__knob" />
    </button>
  );

  if (!label) return toggle;

  return (
    <label className={cx('toggle-label', `toggle-label--${labelPosition}`, 't-ui', className)} style={style}>
      <span className="toggle-label__text">{label}</span>
      {toggle}
    </label>
  );
};

export default Toggle;
