import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveAdminGroups, searchAdminGroups } from '../../services/adminService';
import type { DirectoryGroupDto } from '../../types/admin';
import Combobox from './Combobox';
import { Icon } from './Icon';
import Chip from './Chip';
import Stack from './Stack';
import './GroupPicker.css';

interface GroupPickerProps {
  /** Selected Entra group object ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/** Names already looked up, shared by every picker on the page. */
const nameCache = new Map<string, DirectoryGroupDto>();

/**
 * Search Entra groups by name or object id and pick them. Stores ids, shows names. Admin only:
 * the search endpoint runs with the API's own directory permission.
 */
const GroupPicker: React.FC<GroupPickerProps> = ({ value, onChange, disabled = false }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  // Results are tagged with the text they answer, so a stale list is never shown for a newer query.
  const [results, setResults] = useState<{ text: string; groups: DirectoryGroupDto[] }>({ text: '', groups: [] });
  const [error, setError] = useState<string | null>(null);
  const [, setResolvedTick] = useState(0);

  // Names for ids that arrived from storage rather than from a search.
  useEffect(() => {
    const unknown = value.filter(id => !nameCache.has(id));
    if (unknown.length === 0) return;
    let cancelled = false;
    resolveAdminGroups(unknown)
      .then(groups => {
        if (cancelled) return;
        groups.forEach(group => nameCache.set(group.id, group));
        setResolvedTick(tick => tick + 1);
      })
      .catch(() => { /* the toast has been shown; ids stay visible as ids */ });
    return () => { cancelled = true; };
  }, [value]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchAdminGroups(text)
        .then(groups => {
          if (cancelled) return;
          groups.forEach(group => nameCache.set(group.id, group));
          setResults({ text, groups });
          setError(null);
        })
        .catch(() => { if (!cancelled) setError(t('groupPicker.error')); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, t]);

  const add = (group: DirectoryGroupDto) => {
    nameCache.set(group.id, group);
    if (!value.includes(group.id)) onChange([...value, group.id]);
    setQuery('');
  };

  const remove = (id: string) => onChange(value.filter(candidate => candidate !== id));

  const labelFor = (id: string) => nameCache.get(id)?.displayName ?? null;
  const text = query.trim();
  const current = results.text === text ? results.groups : null;
  const searching = text.length >= 2 && current === null && error === null;
  const candidates = (current ?? []).filter(group => !value.includes(group.id));

  return (
    <div className="group-picker">
      {value.length > 0 && (
        <Stack direction="row" gap="xs" wrap>
          {value.map(id => {
            const name = labelFor(id);
            return (
              <Chip key={id} title={id} onRemove={() => remove(id)} removeLabel={t('groupPicker.remove')} disabled={disabled}>
                <span className={name === null ? 'group-picker-chip-unknown' : undefined}>{name ?? id}</span>
                {name === null && nameCache.has(id) && <span className="group-picker-chip-note t-meta">{t('groupPicker.unknownGroup')}</span>}
              </Chip>
            );
          })}
        </Stack>
      )}
      <Combobox
        inputValue={query}
        onInputChange={next => { setQuery(next); setError(null); }}
        placeholder={t('groupPicker.placeholder')}
        leading={<Icon name="search" size="small" />}
        disabled={disabled}
        openWhen={text.length >= 2}
        items={searching || error ? [] : candidates}
        status={
          searching ? t('groupPicker.searching')
            : error ? <span className="group-picker-error">{error}</span>
              : candidates.length === 0 ? t('groupPicker.noResults')
                : undefined
        }
        getKey={group => group.id}
        renderItem={group => ({
          label: group.displayName ?? group.id,
          description: [group.mail, group.description].filter(Boolean).join(' · ') || group.id,
        })}
        onSelect={add}
      />
    </div>
  );
};

export default GroupPicker;
