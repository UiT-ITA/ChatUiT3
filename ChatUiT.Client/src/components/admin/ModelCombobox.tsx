import React, { useState } from 'react';
import { Icon } from '../common/Icon';

export interface ModelComboboxOption {
  value: string;
  detail?: string;
  // Marks an option that already exists as a saved model
  added?: boolean;
}

interface ModelComboboxProps {
  value: string;
  options: ModelComboboxOption[];
  placeholder?: string;
  addedLabel?: string;
  otherLabel?: string;
  onChange: (value: string) => void;
}

/** A text input that takes a typed value or one picked from the option list below it. */
const ModelCombobox: React.FC<ModelComboboxProps> = ({ value, options, placeholder, addedLabel, otherLabel, onChange }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Options matching the text come first; the rest follow under the "other" heading
  const query = value.trim().toLowerCase();
  const isMatch = (o: ModelComboboxOption) =>
    !!query && (o.value.toLowerCase().includes(query) || (o.detail?.toLowerCase().includes(query) ?? false));
  const matches: ModelComboboxOption[] = [];
  const others: ModelComboboxOption[] = [];
  for (const option of options) (isMatch(option) ? matches : others).push(option);
  const shown = [...matches, ...others];

  const openList = () => {
    setOpen(true);
    setActive(-1);
  };

  const pick = (option: ModelComboboxOption) => {
    onChange(option.value);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openList();
      setActive(i => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && active >= 0 && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const renderOption = (option: ModelComboboxOption, index: number) => (
    <li
      key={option.value}
      role="option"
      aria-selected={option.value === value}
      className={`admin-combobox-option t-body${index === active ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}`}
      onMouseDown={() => pick(option)}
      onMouseEnter={() => setActive(index)}
    >
      <span className="admin-combobox-value">
        {option.value}
        {option.added && <Icon name="check" size={1} className="admin-combobox-added" title={addedLabel} />}
      </span>
      {option.detail && <span className="admin-combobox-detail t-caption">{option.detail}</span>}
    </li>
  );

  return (
    <div className="admin-combobox">
      <input
        className={`admin-input t-body${options.length > 0 ? ' admin-combobox-input' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={openList}
        onClick={() => { if (!open) openList(); }}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open && shown.length > 0}
        autoComplete="off"
      />
      {open && shown.length > 0 && (
        <ul className="admin-combobox-list" role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {matches.map((option, index) => renderOption(option, index))}
          {matches.length > 0 && others.length > 0 && (
            <li className="admin-combobox-heading t-caption" role="presentation">{otherLabel}</li>
          )}
          {others.map((option, index) => renderOption(option, matches.length + index))}
        </ul>
      )}
    </div>
  );
};

export default ModelCombobox;
