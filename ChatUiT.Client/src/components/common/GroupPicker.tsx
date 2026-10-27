import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveAdminGroups, searchAdminGroups } from '../../services/adminService';
import type { DirectoryGroupDto } from '../../types/admin';
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
  const [open, setOpen] = useState(false);
  const [, setResolvedTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const add = (group: DirectoryGroupDto) => {
    nameCache.set(group.id, group);
    if (!value.includes(group.id)) onChange([...value, group.id]);
    setQuery('');
    setOpen(false);
  };

  const remove = (id: string) => onChange(value.filter(candidate => candidate !== id));

  const labelFor = (id: string) => nameCache.get(id)?.displayName ?? null;
  const text = query.trim();
  const current = results.text === text ? results.groups : null;
  const searching = text.length >= 2 && current === null && error === null;
  const candidates = (current ?? []).filter(group => !value.includes(group.id));

  return (
    <div className="group-picker" ref={rootRef}>
      {value.length > 0 && (
        <div className="group-picker-selected">
          {value.map(id => {
            const name = labelFor(id);
            return (
              <span key={id} className={`group-picker-chip t-body${name === null ? ' group-picker-chip-unknown' : ''}`} title={id}>
                <span className="group-picker-chip-name">{name ?? id}</span>
                {name === null && nameCache.has(id) && <span className="group-picker-chip-note t-meta">{t('groupPicker.unknownGroup')}</span>}
                <button type="button" className="group-picker-chip-remove" onClick={() => remove(id)} disabled={disabled} aria-label={t('groupPicker.remove')}>
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="group-picker-search">
        <input
          className="admin-input t-body"
          value={query}
          placeholder={t('groupPicker.placeholder')}
          onChange={e => { setQuery(e.target.value); setError(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
        />
        {open && text.length >= 2 && (
          <div className="group-picker-results">
            {searching && <div className="group-picker-status t-caption">{t('groupPicker.searching')}</div>}
            {!searching && error && <div className="group-picker-status group-picker-error t-caption">{error}</div>}
            {!searching && !error && candidates.length === 0 && <div className="group-picker-status t-caption">{t('groupPicker.noResults')}</div>}
            {candidates.map(group => (
              <button key={group.id} type="button" className="group-picker-result" onClick={() => add(group)}>
                <span className="group-picker-result-name t-body">{group.displayName ?? group.id}</span>
                <span className="group-picker-result-meta t-caption">{[group.mail, group.description].filter(Boolean).join(' · ') || group.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupPicker;
