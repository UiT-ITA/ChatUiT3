import React from 'react';
import { FieldControl } from '@ui-sdk/react/field';
import Field from './Field';
import { hasFieldProps, type FieldProps } from './fieldProps';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Slider.css';

type NativeRangeProps = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step' | 'size' | 'width'>;

interface SliderProps extends FieldProps, LayoutProps, NativeRangeProps {
  value?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

/** The app's range slider. */
const Slider: React.FC<SliderProps> = ({ value, onChange, min = 0, max = 100, step = 1, label, labelAside, description, error, required, className, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  const field: FieldProps = { label, labelAside, description, error, required };
  const wrapped = hasFieldProps(field);

  const slider = (
    <FieldControl
      type="range"
      className={cx('slider', !wrapped && className)}
      style={wrapped ? undefined : style}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
      {...rest}
    />
  );

  return wrapped ? <Field {...field} className={className} style={style}>{slider}</Field> : slider;
};

export default Slider;
