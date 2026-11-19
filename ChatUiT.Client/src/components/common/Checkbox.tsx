import React, { useId } from 'react';
import { Checkbox as UiCheckbox, CheckboxGroup as UiCheckboxGroup, CheckboxIndicator } from '@ui-sdk/react/checkbox';
import { FieldDescription } from './Field';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Checkbox.css';

export interface CheckboxProps extends LayoutProps {
  // Inside a CheckboxGroup: the value it adds to the group's list. Leave checked and onChange off then.
  value?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** The app's checkbox. The children are its label. */
const Checkbox: React.FC<CheckboxProps> = ({ value, checked, onChange, description, disabled, className, children, ...props }) => {
  const [style] = splitLayoutProps(props);
  const descriptionId = useId();
  return (
    <div className={cx('checkbox', disabled && 'checkbox--disabled', className)} style={style}>
      <label className="checkbox__row t-table">
        <UiCheckbox
          value={value}
          checked={checked}
          onCheckedChange={onChange && (next => onChange(next === true))}
          disabled={disabled}
          aria-describedby={description ? descriptionId : undefined}
        >
          <CheckboxIndicator />
        </UiCheckbox>
        {children && <span className="checkbox__label">{children}</span>}
      </label>
      {description && <FieldDescription id={descriptionId} className="checkbox__note">{description}</FieldDescription>}
    </div>
  );
};

interface CheckboxGroupProps extends LayoutProps {
  // The values of the checked boxes inside, in the order the boxes appear. Leave off when each box has its own checked and onChange.
  value?: string[];
  onChange?: (value: string[]) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  children?: React.ReactNode;
}

/** A column of checkboxes. With value, a ui-sdk checkbox group that owns the list of checked values; without, a group for layout only, whose boxes each have their own checked and onChange. */
export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({ value, onChange, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  if (value === undefined) {
    return <div role="group" className="checkbox-group" style={style} {...rest}>{children}</div>;
  }
  return (
    <UiCheckboxGroup className="checkbox-group" style={style} value={value} onValueChange={next => onChange?.(next as string[])} {...rest}>
      {children}
    </UiCheckboxGroup>
  );
};

export default Checkbox;
