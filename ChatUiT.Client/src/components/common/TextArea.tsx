import React, { useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { useInputBase, type InputBaseProps } from './inputBase';

type NativeTextAreaProps = Omit<React.ComponentProps<'textarea'>, keyof InputBaseProps | 'value' | 'defaultValue' | 'onChange'>;

export interface TextAreaProps extends InputBaseProps, NativeTextAreaProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  // Sets the code font and the code background
  monospace?: boolean;
  // Grows with its content between minRows and maxRows
  autoResize?: boolean;
  // 'unstyled' drops the box, for a text area that sits inside another frame such as the chat composer
  variant?: 'outline' | 'unstyled';
  minRows?: number;
  maxRows?: number;
  resize?: 'none' | 'vertical';
}

const LINE_HEIGHT = 1.6;

const supportsFieldSizing = typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content');

/** Sets the height to fit the content, for browsers without field-sizing. */
const fitHeight = (element: HTMLTextAreaElement) => {
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
};

/** The app's multi-line text input. */
const TextArea: React.FC<TextAreaProps> = (props) => {
  const { id, rest, invalid, describedBy, boxClass, boxStyle, frame } = useInputBase(props);
  const { onChange, onInput, monospace = false, autoResize = false, minRows, maxRows, resize = 'vertical', rows = 4, variant = 'outline', ref, ...native } = rest;
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const fitsInScript = autoResize && !supportsFieldSizing;
  useImperativeHandle(ref, () => ownRef.current as HTMLTextAreaElement);

  useLayoutEffect(() => {
    if (fitsInScript && ownRef.current) fitHeight(ownRef.current);
  });

  const style: React.CSSProperties = {
    resize: autoResize ? 'none' : resize,
    minHeight: minRows ? `calc(${minRows * LINE_HEIGHT}em + 1.25rem + 2px)` : undefined,
    maxHeight: maxRows ? `calc(${maxRows * LINE_HEIGHT}em + 1.25rem + 2px)` : undefined,
    ...boxStyle,
  };

  return frame(
    <textarea
      ref={ownRef}
      id={id}
      rows={autoResize ? minRows ?? 1 : rows}
      className={boxClass('input-box--textarea', autoResize && 'input-box--auto-resize', variant === 'unstyled' && 'input-box--unstyled', monospace ? 'input-box--monospace t-code' : props.size === 'large' ? 't-body-lg' : 't-body')}
      style={style}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={onChange && ((e) => onChange(e.target.value, e))}
      onInput={(e) => {
        if (fitsInScript) fitHeight(e.currentTarget);
        onInput?.(e);
      }}
      {...native}
    />,
  );
};

export default TextArea;
