import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Combobox, ComboboxChip, ComboboxChipRemove, ComboboxChips, ComboboxContent, ComboboxCreate, ComboboxInput, ComboboxList, ComboboxValue } from '@ui-sdk/react/combobox';
import IconButton from './IconButton';
import { Icon } from './Icon';
import { OptionContent } from './Listbox';
import { floatingPanelClass } from './floatingPanel';
import { cx, spacePx } from './layout';
import './InputBox.css';
import './Chip.css';
import './TagField.css';

interface TagFieldProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A text input that turns text into removable chips. While typing, a list offers to add the text as a tag, which
 * Enter or a click does; leaving the field adds it too. Backspace in the empty input removes the last chip.
 */
const TagField = ({ tags, onChange, placeholder, disabled = false }: TagFieldProps) => {
  const { t } = useTranslation();
  const boxId = useId();
  const [query, setQuery] = useState('');

  const add = (text: string) => {
    const tag = text.trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
  };

  return (
    <Combobox
      multiple
      allowCustomValue
      value={tags}
      onValueChange={next => onChange(next as string[])}
      query={query}
      onQueryChange={(next, details) => {
        // Leaving the field with text that was not added adds it
        if (details.reason === 'focus-out' || details.reason === 'outside-press') add(query);
        setQuery(next);
      }}
      disabled={disabled}
    >
      <ComboboxChips id={boxId} className={cx('input-box input-box--medium input-box--full-width tag-field', disabled && 'input-box--disabled')}>
        <ComboboxValue>
          {state => (state.value as string[]).map(tag => (
            <ComboboxChip key={tag} value={tag} className="chip chip--solid chip--small chip--removable t-caption-strong">
              <span className="chip__label">{tag}</span>
              <ComboboxChipRemove render={<IconButton icon="close" label={t('common.removeTag', { tag })} variant="inherit" size="xs" />} />
            </ComboboxChip>
          ))}
        </ComboboxValue>
        <ComboboxInput placeholder={tags.length === 0 ? placeholder ?? t('common.addTag') : ''} className="input-box__input tag-field__input t-body" />
      </ComboboxChips>
      <ComboboxContent anchor={`#${boxId}`} sideOffset={spacePx('xs')} className={floatingPanelClass()} style={{ width: 'var(--anchor-width)' }}>
        <ComboboxList>
          <ComboboxCreate onCreate={add}>
            {state => <OptionContent leading={<Icon name="add" size="sm" />}>{t('common.createTag', { tag: state.query.trim() })}</OptionContent>}
          </ComboboxCreate>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};

export default TagField;
