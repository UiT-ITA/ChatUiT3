import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MdClose } from 'react-icons/md';
import './TagField.css';

interface TagFieldProps {
  tags: string[];
  onChange?: (tags: string[]) => void;
  readonly?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

const TagField: React.FC<TagFieldProps> = ({
  tags,
  onChange,
  readonly = false,
  placeholder,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
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

  const handleContainerClick = () => {
    if (!readonly && !disabled && inputRef.current) {
      inputRef.current.focus();
    }
  };

  if (readonly) {
    return (
      <div className="tag-field readonly">
        <div className="tag-list">
          {tags.map((tag, index) => (
            <span key={index} className="tag readonly">
              {tag}
            </span>
          ))}
          {tags.length === 0 && (
            <span className="tag-empty">{t('common.noTags')}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`tag-field ${disabled ? 'disabled' : ''}`}
      onClick={handleContainerClick}
    >
      <div className="tag-list">
        {tags.map((tag, index) => (
          <span key={index} className="tag editable">
            {tag}
            {!disabled && (
              <button
                type="button"
                className="tag-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                aria-label={`Remove ${tag} tag`}
              >
                <MdClose size="0.75rem" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            placeholder={tags.length === 0 ? defaultPlaceholder : ''}
            className="tag-input"
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
};

export default TagField;
