import React from 'react';
import { cx, splitLayoutProps, type LayoutProps, type Size } from './layout';
import './SegmentedControl.css';

export interface SegmentedOption<V extends string> {
  value: V;
  label: React.ReactNode;
  // Content before the label, such as a flag
  leading?: React.ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<V extends string> extends LayoutProps {
  value: V;
  onChange: (value: V) => void;
  options: SegmentedOption<V>[];
  size?: Size;
  // Accessible name of the group
  label: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** A row of mutually exclusive options. */
function SegmentedControl<V extends string>({ value, onChange, options, size = 'medium', label, disabled = false, className, ...props }: SegmentedControlProps<V>) {
  const [style] = splitLayoutProps(props);
  return (
    <div role="radiogroup" aria-label={label} className={cx('segmented-control', className)} style={style}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={cx('segmented-control__option', `segmented-control__option--${size}`, option.value === value && 'segmented-control__option--selected', 't-ui')}
          disabled={disabled || option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.leading && <span className="segmented-control__leading">{option.leading}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
