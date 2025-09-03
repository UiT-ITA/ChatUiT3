export type ThemeName = 'light' | 'dim' | 'dark';
export type SizeName = 'small' | 'medium' | 'large' | 'xl';

export const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dim', label: 'Dim' },
  { value: 'dark', label: 'Dark' },
] as const;

export const SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
] as const;

export function setTheme(themeName: ThemeName): void {
  document.documentElement.dataset.theme = themeName;
  localStorage.setItem('theme', themeName);
}

export function setSize(sizeName: SizeName): void {
  if (sizeName === 'medium') {
    delete document.documentElement.dataset.size;
  } else {
    document.documentElement.dataset.size = sizeName;
  }
  localStorage.setItem('size', sizeName);
}

export function getCurrentTheme(): ThemeName {
  return (document.documentElement.dataset.theme as ThemeName) || 'dim';
}

export function getCurrentSize(): SizeName {
  return (document.documentElement.dataset.size as SizeName) || 'medium';
}

export function getStoredTheme(): ThemeName {
  const stored = localStorage.getItem('theme') as ThemeName;
  return stored && THEME_OPTIONS.some(option => option.value === stored) ? stored : 'dim';
}

export function getStoredSize(): SizeName {
  const stored = localStorage.getItem('size') as SizeName;
  return stored && SIZE_OPTIONS.some(option => option.value === stored) ? stored : 'medium';
}

export function initializeTheme(): void {
  const savedTheme = getStoredTheme();
  const savedSize = getStoredSize();
  setTheme(savedTheme);
  setSize(savedSize);
}
