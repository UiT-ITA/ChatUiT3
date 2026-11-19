import { useState } from 'react';
import { hasChanges } from '../utils/formChanges';

/**
 * An edit form's values, built by formFor. They reset whenever a value in source changes, such as the stored record
 * arriving or being saved, and dirty says whether they differ from what formFor builds.
 */
export function useEditorForm<F extends object>(formFor: () => F, source: readonly unknown[]) {
  const initial = formFor();
  const [form, setForm] = useState(initial);
  const [synced, setSynced] = useState(source);
  if (source.some((value, index) => value !== synced[index])) {
    setSynced(source);
    setForm(initial);
  }
  const set = (patch: Partial<F>) => setForm(prev => ({ ...prev, ...patch }));
  return { form, set, setForm, initial, dirty: hasChanges(form, initial) };
}
