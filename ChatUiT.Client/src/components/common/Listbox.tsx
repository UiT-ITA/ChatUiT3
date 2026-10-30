import React from 'react';
import { Icon } from './Icon';
import { floatingPanelClass } from './floatingPanel';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Listbox.css';

interface ListboxProps extends LayoutProps, Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  // Draws the list as a floating panel under its input
  floating?: boolean;
  // Scrolls the list past this height, as a CSS length
  maxHeight?: string;
}

/** The option list of a combobox or custom dropdown. */
export const Listbox: React.FC<ListboxProps> = ({ floating = false, maxHeight, className, ...props }) => {
  const [layout, rest] = splitLayoutProps(props);
  return (
    <div
      role="listbox"
      className={cx('listbox', floating && 'listbox--floating', floating && floatingPanelClass('auto'), className)}
      style={{ maxHeight, ...layout }}
      {...rest}
    />
  );
};

interface ListboxOptionProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  // Marks the option the arrow keys point at
  highlighted?: boolean;
  disabled?: boolean;
  leading?: React.ReactNode;
  description?: React.ReactNode;
  // Content at the right end, such as a provider name
  trailing?: React.ReactNode;
  // Shows a check mark after the label when selected
  showCheck?: boolean;
}

/** One choice in a Listbox. The children are its label; it may hold buttons, such as a favorite toggle. */
export const ListboxOption: React.FC<ListboxOptionProps> = ({ selected = false, highlighted = false, disabled = false, leading, description, trailing, showCheck = false, onClick, onKeyDown, tabIndex = 0, className, children, ...rest }) => (
  <div
    role="option"
    tabIndex={disabled ? -1 : tabIndex}
    aria-selected={selected}
    aria-disabled={disabled || undefined}
    className={cx('listbox__option', selected && 'listbox__option--selected', highlighted && 'listbox__option--highlighted', disabled && 'listbox__option--disabled', className)}
    onClick={(e) => { if (!disabled) onClick?.(e); }}
    onKeyDown={(e) => {
      onKeyDown?.(e);
      if (!disabled && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
      }
    }}
    {...rest}
  >
    {leading && <span className="listbox__option-leading">{leading}</span>}
    <span className="listbox__option-text">
      <span className="listbox__option-label t-body">
        {children}
        {showCheck && selected && <Icon name="check" size="small" color="accent" />}
      </span>
      {description && <span className="listbox__option-description t-caption">{description}</span>}
    </span>
    {trailing && <span className="listbox__option-trailing t-caption">{trailing}</span>}
  </div>
);

/** A heading that groups the options under it. */
export const ListboxHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="presentation" className="listbox__heading t-caption">{children}</div>
);
