import React from 'react';
import { Icon } from '../common/Icon';
import Combobox from '../common/Combobox';

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
  // Options matching the text come first; the rest follow under the "other" heading
  const query = value.trim().toLowerCase();
  const isMatch = (o: ModelComboboxOption) =>
    !!query && (o.value.toLowerCase().includes(query) || (o.detail?.toLowerCase().includes(query) ?? false));
  const matches: ModelComboboxOption[] = [];
  const others: ModelComboboxOption[] = [];
  for (const option of options) (isMatch(option) ? matches : others).push(option);

  return (
    <Combobox
      inputValue={value}
      onInputChange={onChange}
      placeholder={placeholder}
      sections={[{ items: matches }, { heading: otherLabel, items: others }]}
      getKey={(option) => option.value}
      renderItem={(option) => ({
        label: (
          <>
            {option.value}
            {option.added && <Icon name="check" color="accent" label={addedLabel} />}
          </>
        ),
        trailing: option.detail,
        selected: option.value === value,
      })}
      onSelect={(option) => onChange(option.value)}
      showChevron={options.length > 0}
    />
  );
};

export default ModelCombobox;
