import React from 'react';
import { NumberInput, NumberInputControl, NumberInputDecrement, NumberInputGroup, NumberInputIncrement } from '@ui-sdk/react/number-input';
import Field from './Field';
import { Icon } from './Icon';
import type { FieldProps } from './fieldProps';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './NumberField.css';

interface NumberFieldProps extends FieldProps, LayoutProps {
  // null is an empty field
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

/** A number input with step buttons. Typed values are kept within min and max when the field is left. */
const NumberField: React.FC<NumberFieldProps> = ({ label, labelAside, description, error, required, value, onChange, min, max, step, placeholder, invalid = false, disabled, size = 'medium', ...props }) => {
  const [style] = splitLayoutProps(props);
  const field = { label, labelAside, description, error, required };
  return (
    <Field {...field} style={style}>
      <NumberInput value={value} onValueChange={next => onChange(next)} min={min} max={max} step={step} disabled={disabled} required={required}>
        <NumberInputGroup className={cx('input-box', `input-box--${size}`, 'input-box--full-width', (invalid || error) && 'input-box--invalid', disabled && 'input-box--disabled')}>
          <NumberInputControl className="input-box__input t-body" placeholder={placeholder} />
          <span className="number-field__steps">
            <NumberInputIncrement className="number-field__step"><Icon name="arrowUp" size="sm" /></NumberInputIncrement>
            <NumberInputDecrement className="number-field__step"><Icon name="arrowDown" size="sm" /></NumberInputDecrement>
          </span>
        </NumberInputGroup>
      </NumberInput>
    </Field>
  );
};

export default NumberField;
