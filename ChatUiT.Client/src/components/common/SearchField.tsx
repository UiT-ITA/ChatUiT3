import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import IconButton from './IconButton';
import TextInput, { type TextInputProps } from './TextInput';

export interface SearchFieldProps extends Omit<TextInputProps, 'type' | 'leading' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  // Shows a button that empties the field while it has text
  clearable?: boolean;
  onClear?: () => void;
}

/** The app's search box: a TextInput with a search icon and a clear button. */
const SearchField: React.FC<SearchFieldProps> = ({ value, onChange, clearable = true, onClear, trailing, disabled, size = 'medium', ...rest }) => {
  const { t } = useTranslation();
  const showClear = clearable && value.length > 0 && !disabled;

  return (
    <TextInput
      type="search"
      value={value}
      onChange={(next) => onChange(next)}
      disabled={disabled}
      size={size}
      leading={<Icon name="search" size="small" />}
      trailing={showClear ? (
        <IconButton
          icon="close"
          label={t('common.clear')}
          size="small"
          variant="ghost"
          onClick={() => { onChange(''); onClear?.(); }}
        />
      ) : trailing}
      {...rest}
    />
  );
};

export default SearchField;
