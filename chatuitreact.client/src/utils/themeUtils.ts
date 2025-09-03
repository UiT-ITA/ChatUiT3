export type ThemeName = 'dark-blue' | 'light-blue' | 'dark-green' | 'light-green';

export const THEME_OPTIONS = [
  { value: 'dark-blue', label: 'Dark Blue' },
  { value: 'light-blue', label: 'Light Blue' },
  { value: 'dark-green', label: 'Dark Green' },
  { value: 'light-green', label: 'Light Green' },
] as const;

export function setTheme(themeName: ThemeName): void {
  document.documentElement.dataset.theme = themeName;
  localStorage.setItem('theme', themeName);
}

export function getCurrentTheme(): ThemeName {
  return (document.documentElement.dataset.theme as ThemeName) || 'dark-blue';
}

export function getStoredTheme(): ThemeName {
  const stored = localStorage.getItem('theme') as ThemeName;
  return stored && THEME_OPTIONS.some(option => option.value === stored) ? stored : 'dark-blue';
}

export function initializeTheme(): void {
  const savedTheme = getStoredTheme();
  setTheme(savedTheme);
}
