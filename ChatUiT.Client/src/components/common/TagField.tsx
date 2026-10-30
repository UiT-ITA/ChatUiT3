import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Chip from './Chip';
import { useInputBase, type InputBaseProps } from './inputBase';
import Stack from './Stack';
import './TagField.css';

interface TagFieldProps extends InputBaseProps {
  tags: string[];
  onChange?: (tags: string[]) => void;
  // Shows the tags as plain chips without the input box
  readonly?: boolean;
  placeholder?: string;
}

/** A text input that turns each entry into a removable chip. */
const TagField: React.FC<TagFieldProps> = (props) => {
  const { tags, onChange, readonly = false, placeholder, disabled = false } = props;
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { id, describedBy, invalid, boxClass, boxStyle, frame } = useInputBase(props);

  const defaultPlaceholder = placeholder || t('common.addTag');

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && onChange) {
      onChange([...tags, trimmedTag]);
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    if (onChange) {
      onChange(tags.filter(tag => tag !== tagToRemove));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleInputBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  if (readonly) {
    return frame(
      <Stack direction="row" gap="xs" wrap align="center" style={boxStyle}>
        {tags.map((tag, index) => (
          <Chip key={index} size="small">{tag}</Chip>
        ))}
      </Stack>,
    );
  }

  return frame(
    <div
      className={boxClass('tag-field')}
      style={boxStyle}
      onClick={() => { if (!disabled) inputRef.current?.focus(); }}
    >
      {tags.map((tag, index) => (
        <Chip
          key={index}
          variant="solid"
          size="small"
          onRemove={disabled ? undefined : () => removeTag(tag)}
          removeLabel={`Remove ${tag} tag`}
        >
          {tag}
        </Chip>
      ))}
      {!disabled && (
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          placeholder={tags.length === 0 ? defaultPlaceholder : ''}
          className="input-box__input tag-field__input t-body"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
      )}
    </div>,
  );
};

export default TagField;
