import React from 'react';
import { Textarea } from '@ui-sdk/react/textarea';
import { useInputBase, type InputBaseProps } from './inputBase';

type NativeTextAreaProps = Omit<React.ComponentProps<'textarea'>, keyof InputBaseProps | 'value' | 'defaultValue' | 'onChange' | 'onSubmit'>;

export interface TextAreaProps extends InputBaseProps, NativeTextAreaProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  // Sets the code font and the code background
  monospace?: boolean;
  // Grows with its content between minRows and maxRows
  autoResize?: boolean;
  // 'unstyled' drops the box, for a text area that sits inside another frame such as the chat composer
  variant?: 'outline' | 'unstyled';
  minRows?: number;
  maxRows?: number;
  // Enter submits the surrounding form and Shift+Enter starts a new line
  submitOnEnter?: boolean;
  // Enter calls this instead of submitting the form, and Shift+Enter starts a new line
  onEnter?: (value: string) => void;
}

/** The app's multi-line text input. */
const TextArea: React.FC<TextAreaProps> = (props) => {
  const { rest, invalid, boxClass, boxStyle, frame } = useInputBase(props);
  const { onChange, monospace = false, autoResize = false, minRows, maxRows, rows = 4, variant = 'outline', submitOnEnter = false, onEnter, ...native } = rest;

  const style: React.CSSProperties = {
    resize: autoResize ? 'none' : 'vertical',
    minHeight: minRows ? `calc(${minRows}lh + 2 * var(--space-md) + 2 * var(--border-sm))` : undefined,
    maxHeight: maxRows ? `calc(${maxRows}lh + 2 * var(--space-md) + 2 * var(--border-sm))` : undefined,
    ...boxStyle,
  };

  return frame(
    <Textarea
      rows={autoResize ? minRows ?? 1 : rows}
      autoResize={autoResize}
      submitShortcut={submitOnEnter || onEnter ? 'enter' : undefined}
      onSubmit={onEnter && (value => onEnter(value))}
      className={boxClass('input-box--textarea', variant === 'unstyled' && 'input-box--unstyled', monospace ? 'input-box--monospace t-code' : props.size === 'large' ? 't-body-lg' : 't-body')}
      style={style}
      aria-invalid={invalid || undefined}
      onValueChange={onChange && (value => onChange(value))}
      {...native}
    />,
  );
};

export default TextArea;
