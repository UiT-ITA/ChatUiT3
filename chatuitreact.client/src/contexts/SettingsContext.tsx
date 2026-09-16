import React, { useState, useEffect, ReactNode } from 'react';
import { AppSettings } from '../types/settingsModels';
import { SettingsService } from '../services/settingsService';
import { initializeI18n } from '../i18n';
import { SettingsContext, type SettingsContextType } from '../hooks/useSettings';

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [initialSettings] = useState<AppSettings>(() => SettingsService.loadSettings());
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [isI18nReady, setIsI18nReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initializeI18n(initialSettings.language).then(() => {
      if (cancelled) return;
      SettingsService.applySettings(initialSettings);
      setIsI18nReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [initialSettings]);

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
