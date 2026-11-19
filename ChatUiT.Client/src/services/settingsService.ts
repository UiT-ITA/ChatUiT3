import { AppSettings, DEFAULT_SETTINGS } from '../types/settingsModels';
import { colorScheme, textSize, theme } from './appearance';
import { initializeI18n } from '../i18n';
import { trackError } from './telemetryService';

const SETTINGS_STORAGE_KEY = 'chatuit-settings';

export class SettingsService {
  static loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) {
        const browserLanguage = this.detectBrowserLanguage();
        const initialSettings = {
          ...DEFAULT_SETTINGS,
          language: browserLanguage,
        };
        this.saveSettings(initialSettings);
        return initialSettings;
      }

      const parsed = JSON.parse(stored);

      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };

      return settings;
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
      trackError('storage', { message: 'Settings could not be read from localStorage', error });
      return DEFAULT_SETTINGS;
    }
  }

  private static detectBrowserLanguage(): 'en-US' | 'no-NB' {
    const browserLang = navigator.language || navigator.languages?.[0] || 'en-US';
    
    if (browserLang.startsWith('no') || browserLang.startsWith('nb')) {
      return 'no-NB';
    }
    
    return 'en-US';
  }

  static saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
      trackError('storage', { message: 'Settings could not be saved to localStorage', error });
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
    
    if (key === 'language') {
      await initializeI18n(value as string);
    }
    
    return newSettings;
  }

  static exportData(format: 'json' | 'markdown' | 'txt'): void {
    // Exports the settings only. `format` picks the file extension; the payload is always JSON.
    const data = {
      settings: { ...this.loadSettings(), theme: theme.get().value, mode: colorScheme.get().value, size: textSize.get().value },
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
    // Local browser storage only — nothing stored server-side is deleted.
    localStorage.clear();
    window.location.reload();
  }
}
