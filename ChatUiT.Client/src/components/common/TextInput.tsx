import React from 'react';
import { Input } from '@ui-sdk/react/input';
import { useInputBase, type InputBaseProps } from './inputBase';
import { cx } from './layout';

type NativeInputProps = Omit<React.ComponentProps<'input'>, keyof InputBaseProps | 'value' | 'defaultValue' | 'onChange' | 'width'>;

export interface TextInputProps extends InputBaseProps, NativeInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  // Content inside the box before and after the text, such as an icon
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  // Sets the code font and the code background
  monospace?: boolean;
}

/** The app's single-line text input. */
const TextInput: React.FC<TextInputProps> = (props) => {
  const { rest, invalid, boxClass, boxStyle, frame } = useInputBase(props);
  const { onChange, leading, trailing, monospace = false, ...native } = rest;

  return frame(
    <div className={boxClass('text-input', monospace && 'input-box--monospace')} style={boxStyle}>
      {leading && <span className="input-box__adornment">{leading}</span>}
      <Input
        className={cx('input-box__input', monospace ? 't-code' : 't-body')}
        aria-invalid={invalid || undefined}
        onValueChange={onChange && (value => onChange(value))}
        {...native}
      />
      {trailing && <span className="input-box__adornment">{trailing}</span>}
    </div>,
  );
};

export default TextInput;
