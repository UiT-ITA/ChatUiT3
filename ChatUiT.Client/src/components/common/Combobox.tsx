import React, { useId, useState } from 'react';
import { Listbox, ListboxHeading, ListboxOption } from './Listbox';
import { SelectChevron } from './Select';
import TextInput, { type TextInputProps } from './TextInput';
import './Combobox.css';

export interface ComboboxSection<T> {
  heading?: React.ReactNode;
  items: T[];
}

/** How one item shows in the list. */
export interface ComboboxItemView {
  label: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
}

interface ComboboxProps<T> extends Omit<TextInputProps, 'value' | 'defaultValue' | 'onChange' | 'onSelect' | 'role'> {
  inputValue: string;
  onInputChange: (value: string) => void;
  // The suggestions, as one list or in headed sections
  items?: T[];
  sections?: ComboboxSection<T>[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ComboboxItemView;
  onSelect: (item: T) => void;
  // Shown in the list instead of options, such as "Searching…" or "No results"
  status?: React.ReactNode;
  // The list opens only while this holds, such as once enough text is typed
  openWhen?: boolean;
  // Shows the dropdown chevron at the right end
  showChevron?: boolean;
  listMaxHeight?: string;
}

/** A text input with a list of suggestions under it, picked by mouse or arrow keys and Enter. */
function Combobox<T>({
  inputValue,
  onInputChange,
  items,
  sections,
  getKey,
  renderItem,
  onSelect,
  status,
  openWhen = true,
  showChevron = false,
  listMaxHeight = '18rem',
  onFocus,
  onBlur,
  onClick,
  onKeyDown,
  ...inputProps
}: ComboboxProps<T>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const groups: ComboboxSection<T>[] = sections ?? [{ items: items ?? [] }];
  const flat = groups.flatMap(group => group.items);
  const showList = open && openWhen && (flat.length > 0 || Boolean(status));
  const optionId = (index: number) => `${listId}-${index}`;

  const openList = () => {
    setOpen(true);
    setActive(-1);
  };

  const pick = (item: T) => {
    onSelect(item);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) openList();
      setActive(index => Math.min(index + 1, flat.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && showList && active >= 0 && flat[active]) {
      event.preventDefault();
      pick(flat[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  const offsets = groups.map((_, groupIndex) => groups.slice(0, groupIndex).reduce((count, group) => count + group.items.length, 0));

  return (
    <div className="combobox">
      <TextInput
        {...inputProps}
        value={inputValue}
        onChange={(next) => { onInputChange(next); setOpen(true); setActive(-1); }}
        onFocus={(event) => { openList(); onFocus?.(event); }}
        onClick={(event) => { if (!open) openList(); onClick?.(event); }}
        onBlur={(event) => { setOpen(false); onBlur?.(event); }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        trailing={showChevron ? <SelectChevron /> : inputProps.trailing}
      />
      {showList && (
        // Keeps focus in the input while an option is clicked
        <Listbox id={listId} floating maxHeight={listMaxHeight} onMouseDown={(event) => event.preventDefault()}>
          {status && <div className="combobox__status t-caption">{status}</div>}
          {groups.map((group, groupIndex) => (
            <React.Fragment key={groupIndex}>
              {group.heading && group.items.length > 0 && groups.slice(0, groupIndex).some(earlier => earlier.items.length > 0) && (
                <ListboxHeading>{group.heading}</ListboxHeading>
              )}
              {group.items.map((item, position) => {
                const itemIndex = offsets[groupIndex] + position;
                const view = renderItem(item);
                return (
                  <ListboxOption
                    key={getKey(item)}
                    id={optionId(itemIndex)}
                    tabIndex={-1}
                    selected={view.selected}
                    highlighted={itemIndex === active}
                    description={view.description}
                    trailing={view.trailing}
                    onClick={() => pick(item)}
                    onMouseEnter={() => setActive(itemIndex)}
                  >
                    {view.label}
                  </ListboxOption>
                );
              })}
            </React.Fragment>
          ))}
        </Listbox>
      )}
    </div>
  );
}

export default Combobox;
