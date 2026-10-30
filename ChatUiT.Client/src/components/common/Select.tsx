import React from 'react';
import { Icon } from './Icon';
import { useInputBase, type InputBaseProps } from './inputBase';
import './Select.css';

/** The chevron at the right end of every dropdown box. */
export const SelectChevron: React.FC = () => <Icon name="arrowDown" size="large" className="select__chevron" />;

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

type NativeSelectProps = Omit<React.ComponentProps<'select'>, keyof InputBaseProps | 'value' | 'defaultValue' | 'onChange'>;

export interface SelectProps extends InputBaseProps, NativeSelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, event: React.ChangeEvent<HTMLSelectElement>) => void;
  // The choices. <option> children work as well.
  options?: SelectOption[];
  // A first, unselectable entry shown while nothing is chosen
  placeholder?: string;
  // Sizes the box to its content instead of the full width
  inline?: boolean;
}

/** The app's dropdown box. */
const Select: React.FC<SelectProps> = ({ inline = false, ...props }) => {
  const { id, rest, invalid, describedBy, boxClass, boxStyle, frame } = useInputBase({ ...props, fullWidth: props.fullWidth ?? !inline });
  const { onChange, options, placeholder, children, ...native } = rest;

  return frame(
    <div className={boxClass('select', inline && 'select--inline')} style={boxStyle}>
      <select
        id={id}
        className="input-box__input select__input t-body"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={onChange && ((e) => onChange(e.target.value, e))}
        {...native}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options?.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled} title={option.title}>{option.label}</option>
        ))}
        {children}
      </select>
      <SelectChevron />
    </div>,
  );
};

export default Select;
