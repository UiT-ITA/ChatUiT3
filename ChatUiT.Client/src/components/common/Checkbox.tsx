import React, { useEffect, useId, useImperativeHandle, useRef } from 'react';
import { FieldDescription } from './Field';
import { fieldDescribedBy } from './fieldProps';
import { cx, splitLayoutProps, type LayoutProps, type Size, type Space } from './layout';
import Stack from './Stack';
import './Checkbox.css';

type NativeCheckboxProps = Omit<React.ComponentProps<'input'>, 'type' | 'checked' | 'defaultChecked' | 'onChange' | 'size' | 'width'>;

export interface CheckboxProps extends LayoutProps, NativeCheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  // Shows a dash: some but not all of a group is checked
  indeterminate?: boolean;
  size?: Size;
  invalid?: boolean;
  description?: React.ReactNode;
  error?: React.ReactNode;
}

/** The app's checkbox. The children are its label. */
const Checkbox: React.FC<CheckboxProps> = ({ checked, defaultChecked, onChange, indeterminate = false, size = 'medium', invalid = false, description, error, disabled, id: givenId, ref, className, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  const generatedId = useId();
  const id = givenId ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div className={cx('checkbox', `checkbox--${size}`, disabled && 'checkbox--disabled', (invalid || error) && 'checkbox--invalid', className)} style={style}>
      <label className="checkbox__row t-table" htmlFor={id}>
        <input
          ref={inputRef}
          id={id}
          type="checkbox"
          className="checkbox__input"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange && ((e) => onChange(e.target.checked, e))}
          disabled={disabled}
          aria-invalid={invalid || Boolean(error) || undefined}
          aria-describedby={fieldDescribedBy(id, { description, error })}
          {...rest}
        />
        {children && <span className="checkbox__label">{children}</span>}
      </label>
      {description && <FieldDescription id={`${id}-description`} className="checkbox__note">{description}</FieldDescription>}
      {error && <FieldDescription id={`${id}-error`} tone="danger" role="alert" className="checkbox__note">{error}</FieldDescription>}
    </div>
  );
};

interface CheckboxGroupProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  direction?: 'row' | 'column';
  gap?: Space;
}

/** A row or column of checkboxes. */
export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({ direction = 'column', gap = 'sm', ...rest }) => (
  <Stack role="group" direction={direction} gap={gap} wrap={direction === 'row'} {...rest} />
);

export default Checkbox;
