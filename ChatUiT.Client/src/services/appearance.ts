import { usePreference } from '@ui-sdk/react/preferences';
import { createColorScheme, createLocalStorage, createPreference, type ChangeDetails } from '@ui-sdk/core';
import { track } from './telemetryService';

// Tracks a choice the user made, not one restored from storage or synced from another tab
const trackChange = (setting: string) => (value: string, details: ChangeDetails) => {
  if (details.reason !== 'restore' && details.reason !== 'storage-sync') track('client.setting_changed', { setting, value });
};

/** Light, dark, or the browser's scheme, on <html> as data-color-scheme. */
export const colorScheme = createColorScheme({
  global: true,
  storage: createLocalStorage('chatuit-color-scheme'),
  onValueChange: trackChange('mode'),
});

/** The colour theme, on <html> as data-theme. */
export const theme = createPreference({
  values: ['blue', 'grey'] as const,
  defaultValue: 'blue',
  attribute: 'data-theme',
  global: true,
  storage: createLocalStorage('chatuit-theme'),
  onValueChange: trackChange('theme'),
});

/** The text size, on <html> as data-size. */
export const textSize = createPreference({
  values: ['small', 'medium', 'large', 'xl'] as const,
  defaultValue: 'medium',
  attribute: 'data-size',
  global: true,
  storage: createLocalStorage('chatuit-text-size'),
  onValueChange: trackChange('size'),
});

export const APPEARANCE = [colorScheme, theme, textSize];

/** Whether the page shows dark now, a switch to the other scheme, and the logo that reads on the current background. */
export function useDarkMode() {
  const dark = usePreference(colorScheme).resolved === 'dark';
  return {
    dark,
    toggle: () => colorScheme.set(dark ? 'light' : 'dark'),
    logo: dark ? '/chatuit-logo.svg' : '/chatuit-logo-darkblue.svg',
  };
}
