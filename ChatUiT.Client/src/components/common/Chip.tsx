import React from 'react';
import IconButton from './IconButton';
import { cx, splitLayoutProps, type LayoutProps, type Size } from './layout';
import './Chip.css';

interface ChipProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  // 'solid' fills with the accent color, 'subtle' is a framed panel
  variant?: 'solid' | 'subtle';
  size?: Exclude<Size, 'large'>;
  // Shows a remove button that calls this
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
}

/** A compact label for a tag, a group or another chosen value. The children are its text. */
const Chip: React.FC<ChipProps> = ({ variant = 'subtle', size = 'medium', onRemove, removeLabel, disabled = false, className, children, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  return (
    <span className={cx('chip', `chip--${variant}`, `chip--${size}`, onRemove && 'chip--removable', size === 'small' ? 't-caption-strong' : 't-body', className)} style={style} {...rest}>
      <span className="chip__label">{children}</span>
      {onRemove && (
        <IconButton
          icon="close"
          label={removeLabel ?? ''}
          variant="inherit"
          size="xs"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        />
      )}
    </span>
  );
};

export default Chip;
