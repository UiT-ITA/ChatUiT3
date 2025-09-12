import { AppSettings, DEFAULT_SETTINGS } from '../types/settingsModels';
import { setTheme, setSize } from '../utils/themeUtils';
import { setScale } from '../utils/scaleUtils';
import i18n from '../i18n';

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

      const parsed = JSON.parse(stored);
      
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

  static applySettings(settings: AppSettings): void {
    // Apply theme
    setTheme(settings.theme);
    
    // Apply size (which is also used as scale)
    setSize(settings.size);
    setScale(settings.size);
    
    // Apply language
    if (i18n.language !== settings.language) {
      i18n.changeLanguage(settings.language);
    }
  }

  static updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
    currentSettings: AppSettings
  ): AppSettings {
    const newSettings = {
      ...currentSettings,
      [key]: value,
    };

    this.saveSettings(newSettings);
    this.applySettings(newSettings);
    
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
