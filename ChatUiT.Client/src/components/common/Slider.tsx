import React, { useId } from 'react';
import Field from './Field';
import { fieldDescribedBy, hasFieldProps, type FieldProps } from './fieldProps';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Slider.css';

type NativeRangeProps = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step' | 'size' | 'width'>;

interface SliderProps extends FieldProps, LayoutProps, NativeRangeProps {
  value?: number;
  defaultValue?: number;
  onChange: (value: number, event: React.ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  step?: number;
}

/** The app's range slider. */
const Slider: React.FC<SliderProps> = ({ value, defaultValue, onChange, min = 0, max = 100, step = 1, label, labelAside, description, error, required, id: givenId, className, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  const generatedId = useId();
  const id = givenId ?? generatedId;
  const field: FieldProps = { label, labelAside, description, error, required };
  const wrapped = hasFieldProps(field);

  const slider = (
    <input
      id={id}
      type="range"
      className={cx('slider', !wrapped && className)}
      style={wrapped ? undefined : style}
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value), e)}
      aria-describedby={fieldDescribedBy(id, field)}
      {...rest}
    />
  );

  return wrapped ? <Field {...field} htmlFor={id} className={className} style={style}>{slider}</Field> : slider;
};

export default Slider;
