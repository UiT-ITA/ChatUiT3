import React from 'react';
import { SegmentedControl as UiSegmentedControl, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
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
  // Spans the width of its container, with options of equal width
  stretch?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** A row of mutually exclusive options. */
function SegmentedControl<V extends string>({ value, onChange, options, size = 'medium', label, stretch = false, className, ...props }: SegmentedControlProps<V>) {
  const [style] = splitLayoutProps(props);
  return (
    <UiSegmentedControl
      aria-label={label}
      value={value}
      onValueChange={next => { if (next !== null) onChange(next as V); }}
      className={cx('segmented-control', stretch && 'segmented-control--stretch', className)}
      style={style}
    >
      {options.map(option => (
        <SegmentedControlItem
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cx('segmented-control__option', `segmented-control__option--${size}`, 't-ui')}
        >
          {option.leading && <span className="segmented-control__leading">{option.leading}</span>}
          {option.label}
        </SegmentedControlItem>
      ))}
    </UiSegmentedControl>
  );
}

export default SegmentedControl;
