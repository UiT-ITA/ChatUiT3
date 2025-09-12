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
}

export function setSize(sizeName: SizeName): void {
  if (sizeName === 'medium') {
    delete document.documentElement.dataset.size;
  } else {
    document.documentElement.dataset.size = sizeName;
  }
}

export function getCurrentTheme(): ThemeName {
  return (document.documentElement.dataset.theme as ThemeName) || 'dim';
}

export function getCurrentSize(): SizeName {
  return (document.documentElement.dataset.size as SizeName) || 'medium';
}
