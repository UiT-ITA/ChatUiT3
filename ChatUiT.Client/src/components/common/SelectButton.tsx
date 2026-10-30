import React from 'react';
import { useInputBase, type InputBaseProps } from './inputBase';
import { SelectChevron } from './Select';
import './Select.css';

type NativeButtonProps = Omit<React.ComponentProps<'button'>, keyof InputBaseProps | 'type'>;

export interface SelectButtonProps extends InputBaseProps, NativeButtonProps {
  // Whether the list it opens is showing
  open?: boolean;
  // Shown while children is empty
  placeholder?: string;
}

/** A dropdown box that shows custom content and opens a custom list. Looks like Select. */
const SelectButton: React.FC<SelectButtonProps> = (props) => {
  const { id, rest, invalid, describedBy, boxClass, boxStyle, frame } = useInputBase(props);
  const { open = false, placeholder, children, ...native } = rest;
  const empty = children === undefined || children === null || children === false;

  return frame(
    <button
      id={id}
      type="button"
      className={boxClass('select-button', 't-body')}
      style={boxStyle}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {...native}
    >
      <span className="select-button__value">
        {empty ? <span className="select-button__placeholder">{placeholder}</span> : children}
      </span>
      <SelectChevron />
    </button>,
  );
};

export default SelectButton;
