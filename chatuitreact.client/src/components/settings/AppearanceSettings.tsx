import React from 'react';
import { useTheme, Theme, TextScale } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const AppearanceSettings: React.FC = () => {
  const { t } = useTranslation();
  const { theme, textScale, setTheme, setTextScale } = useTheme();

  const themes: { id: Theme; label: string; description: string }[] = [
    {
      id: 'light',
      label: t('settings.theme.light'),
      description: t('settings.theme.lightDescription'),
    },
    {
      id: 'dark',
      label: t('settings.theme.dark'),
      description: t('settings.theme.darkDescription'),
    },
    {
      id: 'alt-dark',
      label: t('settings.theme.altDark'),
      description: t('settings.theme.altDarkDescription'),
    },
  ];

  const textScales: { id: TextScale; label: string; description: string }[] = [
    {
      id: 'small',
      label: t('settings.textScale.small'),
      description: t('settings.textScale.smallDescription'),
    },
    {
      id: 'medium',
      label: t('settings.textScale.medium'),
      description: t('settings.textScale.mediumDescription'),
    },
    {
      id: 'large',
      label: t('settings.textScale.large'),
      description: t('settings.textScale.largeDescription'),
    },
  ];

  return (
    <div className="settings-section">
      <div className="settings-group">
        <h3 className="settings-group-title">{t('settings.theme.title')}</h3>
        <p className="settings-group-description">{t('settings.theme.description')}</p>
        
        <div className="settings-options">
          {themes.map((themeOption) => (
            <label key={themeOption.id} className="settings-option">
              <input
                type="radio"
                name="theme"
                value={themeOption.id}
                checked={theme === themeOption.id}
                onChange={() => setTheme(themeOption.id)}
                className="settings-option-input"
              />
              <div className="settings-option-content">
                <div className="settings-option-label">{themeOption.label}</div>
                <div className="settings-option-description">{themeOption.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">{t('settings.textScale.title')}</h3>
        <p className="settings-group-description">{t('settings.textScale.description')}</p>
        
        <div className="settings-options">
          {textScales.map((scaleOption) => (
            <label key={scaleOption.id} className="settings-option">
              <input
                type="radio"
                name="textScale"
                value={scaleOption.id}
                checked={textScale === scaleOption.id}
                onChange={() => setTextScale(scaleOption.id)}
                className="settings-option-input"
              />
              <div className="settings-option-content">
                <div className="settings-option-label">{scaleOption.label}</div>
                <div className="settings-option-description">{scaleOption.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
