import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAsyncOptions } from '@ui-sdk/react/async-options';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxStatus } from '@ui-sdk/react/combobox';
import type { DirectoryGroupDto } from '../../types/admin';
import { Icon } from './Icon';
import Chip from './Chip';
import Stack from './Stack';
import { OptionContent } from './Listbox';
import { floatingPanelClass } from './floatingPanel';
import { spacePx } from './layout';
import './GroupPicker.css';

interface GroupPickerProps {
  /** Selected Entra group object ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  // Finds groups whose name or object id matches the text
  search: (text: string) => Promise<DirectoryGroupDto[]>;
  // Looks up the groups of the given ids
  resolve: (ids: string[]) => Promise<DirectoryGroupDto[]>;
  disabled?: boolean;
}

/** Names already looked up, shared by every picker on the page. */
const nameCache = new Map<string, DirectoryGroupDto>();

/** Searches Entra groups by name or object id and picks them. Stores ids, shows names. */
const GroupPicker: React.FC<GroupPickerProps> = ({ value, onChange, search, resolve, disabled = false }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [, setResolvedTick] = useState(0);
  const groups = useAsyncOptions(async (text: string) => {
    if (text.trim().length < 2) return [];
    const found = await search(text.trim());
    found.forEach(group => nameCache.set(group.id, group));
    return found;
  }, { debounce: 300 });

  // Looks up the names of the ids that are not in the cache
  useEffect(() => {
    const unknown = value.filter(id => !nameCache.has(id));
    if (unknown.length === 0) return;
    let cancelled = false;
    resolve(unknown)
      .then(found => {
        if (cancelled) return;
        found.forEach(group => nameCache.set(group.id, group));
        setResolvedTick(tick => tick + 1);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [value, resolve]);

  const labelFor = (id: string) => nameCache.get(id)?.displayName ?? null;
  const searching = query.trim().length >= 2;

  return (
    <div className="group-picker">
      {value.length > 0 && (
        <Stack direction="row" gap="xs" wrap>
          {value.map(id => {
            const name = labelFor(id);
            return (
              <Chip key={id} title={id} onRemove={() => onChange(value.filter(candidate => candidate !== id))} removeLabel={t('groupPicker.remove')} disabled={disabled}>
                <span className={name === null ? 'group-picker-chip-unknown' : undefined}>{name ?? id}</span>
                {name === null && nameCache.has(id) && <span className="group-picker-chip-note t-meta">{t('groupPicker.unknownGroup')}</span>}
              </Chip>
            );
          })}
        </Stack>
      )}
      <Combobox
        multiple
        value={value}
        onValueChange={ids => onChange(ids as string[])}
        itemToLabel={id => labelFor(id as string) ?? (id as string)}
        status={groups.status}
        filter={false}
        query={query}
        onQueryChange={next => { setQuery(next); groups.setQuery(next); }}
        disabled={disabled}
      >
        <div className="input-box input-box--medium input-box--full-width text-input">
          <span className="input-box__adornment"><Icon name="search" size="sm" /></span>
          <ComboboxInput className="input-box__input t-body" placeholder={t('groupPicker.placeholder')} />
        </div>
        {searching && (
          <ComboboxContent sideOffset={spacePx('xs')} className={floatingPanelClass()} style={{ width: 'var(--anchor-width)' }}>
            <ComboboxStatus className="t-caption">
              {state => state.status === 'error' ? <span className="group-picker-error">{t('groupPicker.error')}</span> : state.loading ? t('groupPicker.searching') : null}
            </ComboboxStatus>
            <ComboboxEmpty className="t-caption">
              {state => state.empty && !state.loading && groups.status !== 'error' ? t('groupPicker.noResults') : null}
            </ComboboxEmpty>
            <ComboboxList>
              {groups.items.map(group => (
                <ComboboxItem key={group.id} value={group.id} label={group.displayName ?? group.id}>
                  <OptionContent description={[group.mail, group.description].filter(Boolean).join(' · ') || group.id}>
                    {group.displayName ?? group.id}
                  </OptionContent>
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        )}
      </Combobox>
    </div>
  );
};

export default GroupPicker;
