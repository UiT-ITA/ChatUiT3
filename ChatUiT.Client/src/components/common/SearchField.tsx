import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input, InputClear, InputGroup } from '@ui-sdk/react/input';
import { Icon } from './Icon';
import IconButton from './IconButton';
import './InputBox.css';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: 'small' | 'medium';
}

/** The app's search box: a search icon, the text, and a clear button while it has text. */
const SearchField: React.FC<SearchFieldProps> = ({ value, onChange, placeholder, size = 'medium' }) => {
  const { t } = useTranslation();
  return (
    <InputGroup className={`input-box input-box--${size} input-box--full-width text-input`}>
      <span className="input-box__adornment"><Icon name="search" size="sm" /></span>
      <Input type="search" className="input-box__input t-body" value={value} onValueChange={next => onChange(next)} placeholder={placeholder} />
      <InputClear render={<IconButton icon="close" label={t('common.clear')} size="small" variant="ghost" />} />
    </InputGroup>
  );
};

export default SearchField;
