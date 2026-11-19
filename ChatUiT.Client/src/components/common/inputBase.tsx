import React from 'react';
import Field from './Field';
import { hasFieldProps, type FieldProps } from './fieldProps';
import { cx, splitLayoutProps, type LayoutProps, type Size } from './layout';
import './InputBox.css';

/** Parameters every form input takes. */
export interface InputBaseProps extends FieldProps, LayoutProps {
  size?: Size;
  invalid?: boolean;
  disabled?: boolean;
  // Fills the width of its container. On by default.
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

type InputBase<P> = {
  // The props left for the native element
  rest: Omit<P, keyof InputBaseProps>;
  invalid: boolean;
  boxClass: (...extra: unknown[]) => string;
  // Style for the box when no Field wraps it
  boxStyle: React.CSSProperties | undefined;
  // Wraps the control in a Field when the input has a label or notes
  frame: (control: React.ReactNode) => React.ReactNode;
};

/** The shared part of every form input: label and notes, size, validity and placement. */
export function useInputBase<P extends InputBaseProps>(props: P): InputBase<P> {
  const { label, labelAside, description, error, required, size = 'medium', invalid = false, disabled, fullWidth = true, className, ...others } = props;
  const [layoutStyle, rest] = splitLayoutProps(others);
  const field: FieldProps = { label, labelAside, description, error, required };
  const wrapped = hasFieldProps(field);
  const isInvalid = invalid || Boolean(error);

  return {
    rest: { ...rest, required, disabled } as unknown as Omit<P, keyof InputBaseProps>,
    invalid: isInvalid,
    boxClass: (...extra) => cx(
      'input-box',
      `input-box--${size}`,
      fullWidth && 'input-box--full-width',
      isInvalid && 'input-box--invalid',
      disabled && 'input-box--disabled',
      ...extra,
      !wrapped && className,
    ),
    boxStyle: wrapped ? undefined : layoutStyle,
    frame: (control) => wrapped
      ? <Field {...field} className={className} style={layoutStyle}>{control}</Field>
      : control,
  };
}
