import { AppSettings, DEFAULT_SETTINGS } from '../types/settingsModels';
import { setTheme, setMode, setSize } from '../utils/themeUtils';
import { initializeI18n } from '../i18n';

const SETTINGS_STORAGE_KEY = 'chatuit-settings';

export class SettingsService {
  static loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) {
        // No stored settings - detect browser language and create initial settings
        const browserLanguage = this.detectBrowserLanguage();
        const initialSettings = {
          ...DEFAULT_SETTINGS,
          language: browserLanguage,
        };
        this.saveSettings(initialSettings);
        return initialSettings;
      }

      const parsed = this.migrateSettings(JSON.parse(stored));

      // Merge with defaults to ensure all properties exist
      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };

      return settings;
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
      return DEFAULT_SETTINGS;
    }
  }

  private static detectBrowserLanguage(): 'en-US' | 'no-NB' {
    const browserLang = navigator.language || navigator.languages?.[0] || 'en-US';
    
    // Check if browser language matches our supported languages
    if (browserLang.startsWith('no') || browserLang.startsWith('nb')) {
      return 'no-NB';
    }
    
    // Default to English for all other languages
    return 'en-US';
  }

  static saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }

  // Older versions stored theme as light/dim/dark; split into theme + mode
  private static migrateSettings(parsed: Record<string, unknown>): Record<string, unknown> {
    if (parsed.theme === 'light' || parsed.theme === 'dim' || parsed.theme === 'dark') {
      parsed.mode = parsed.theme === 'light' ? 'light' : 'dark';
      parsed.theme = 'blue';
    }
    return parsed;
  }

  static applySettings(settings: AppSettings): void {
    setTheme(settings.theme);
    setMode(settings.mode);
    setSize(settings.size);
    this.watchSystemMode(settings);
  }

  private static systemModeQuery: MediaQueryList | null = null;
  private static systemModeListener: (() => void) | null = null;

  // Re-resolve data-mode when the OS scheme changes and mode is "system"
  private static watchSystemMode(settings: AppSettings): void {
    if (this.systemModeQuery && this.systemModeListener) {
      this.systemModeQuery.removeEventListener('change', this.systemModeListener);
      this.systemModeQuery = null;
      this.systemModeListener = null;
    }
    if (settings.mode === 'system' && window.matchMedia) {
      this.systemModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemModeListener = () => setMode('system');
      this.systemModeQuery.addEventListener('change', this.systemModeListener);
    }
  }

  static async updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
    currentSettings: AppSettings
  ): Promise<AppSettings> {
    const newSettings = {
      ...currentSettings,
      [key]: value,
    };

    this.saveSettings(newSettings);
    this.applySettings(newSettings);
    
    if (key === 'language') {
      await initializeI18n(value as string);
    }
    
    return newSettings;
  }

  static exportData(format: 'json' | 'markdown' | 'txt'): void {
    // Dummy implementation for now
    const data = {
      settings: this.loadSettings(),
      exportDate: new Date().toISOString(),
      format: format,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatuit-export-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static deleteAllData(): void {
    // Dummy implementation for now
    if (confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  }
}
