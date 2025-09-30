import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings } from '../types/settingsModels';
import { SettingsService } from '../services/settingsService';
import { initializeI18n } from '../i18n';

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  exportData: (format: 'json' | 'markdown' | 'txt') => void;
  deleteAllData: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => SettingsService.loadSettings());
  const [isI18nReady, setIsI18nReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      await initializeI18n(settings.language);
      SettingsService.applySettings(settings);
      setIsI18nReady(true);
    };

    initializeApp();
  }, []);

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = await SettingsService.updateSetting(key, value, settings);
    setSettings(newSettings);
  };

  const exportData = (format: 'json' | 'markdown' | 'txt') => {
    SettingsService.exportData(format);
  };

  const deleteAllData = () => {
    SettingsService.deleteAllData();
  };

  const contextValue: SettingsContextType = {
    settings,
    updateSetting,
    exportData,
    deleteAllData,
  };

  if (!isI18nReady) {
    return null;
  }

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
