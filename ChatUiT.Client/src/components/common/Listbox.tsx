import React from 'react';
import './Listbox.css';

interface OptionContentProps {
  leading?: React.ReactNode;
  description?: React.ReactNode;
  // Content at the right end, such as a provider name
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

/** The inside of an option in a ui-sdk Select, Combobox, Autocomplete or Listbox: leading content, the label with a description, and trailing content. */
export const OptionContent: React.FC<OptionContentProps> = ({ leading, description, trailing, children }) => (
  <>
    {leading && <span className="option__leading">{leading}</span>}
    <span className="option__text">
      <span className="option__label t-body">{children}</span>
      {description && <span className="option__description t-caption">{description}</span>}
    </span>
    {trailing && <span className="option__trailing t-caption">{trailing}</span>}
  </>
);
