export type ThemeName = 'blue' | 'grey';
export type ModeName = 'light' | 'dark' | 'system';
export type ResolvedMode = 'light' | 'dark';
export type SizeName = 'small' | 'medium' | 'large' | 'xl';

export const THEME_OPTIONS = [
  { value: 'blue', label: 'Blue' },
  { value: 'grey', label: 'Grey' },
] as const;

export const MODE_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const;

export const SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
] as const;

export function resolveMode(mode: ModeName): ResolvedMode {
  if (mode === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function setTheme(themeName: ThemeName): void {
  document.documentElement.dataset.theme = themeName;
}

export function setMode(mode: ModeName): void {
  document.documentElement.dataset.mode = resolveMode(mode);
}

export function setSize(sizeName: SizeName): void {
  if (sizeName === 'medium') {
    delete document.documentElement.dataset.size;
  } else {
    document.documentElement.dataset.size = sizeName;
  }
}

export function getCurrentMode(): ResolvedMode {
  return (document.documentElement.dataset.mode as ResolvedMode) || 'light';
}

// Component theming follows the resolved light/dark mode
type MermaidTheme = 'dark' | 'default' | 'base' | 'forest' | 'neutral' | 'null';

const MODE_CONFIG: Record<ResolvedMode, { mermaid: MermaidTheme; codeblock: string }> = {
  light: { mermaid: 'neutral', codeblock: 'oneLight' },
  dark: { mermaid: 'dark', codeblock: 'atomDark' },
};

export function getMermaidTheme(mode: ModeName): MermaidTheme {
  return MODE_CONFIG[resolveMode(mode)].mermaid;
}

export function getCodeblockTheme(mode: ModeName): string {
  return MODE_CONFIG[resolveMode(mode)].codeblock;
}
