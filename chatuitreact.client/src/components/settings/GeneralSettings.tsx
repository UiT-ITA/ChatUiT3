import React from 'react';
import { useTheme, Theme, TextScale, ChatWidth } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../common/LanguageSwitcher';

const GeneralSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, textScale, chatWidth, markdownEnabled, setTheme, setTextScale, setChatWidth, setMarkdownEnabled } = useTheme();

  const themes: { id: Theme; label: string }[] = [
    { id: 'light', label: t('settings.theme.light') },
    { id: 'dark', label: t('settings.theme.dark') },
    { id: 'alt-dark', label: t('settings.theme.altDark') },
  ];

  const textScales: { id: TextScale; label: string }[] = [
    { id: 'small', label: t('settings.textScale.small') },
    { id: 'medium', label: t('settings.textScale.medium') },
    { id: 'large', label: t('settings.textScale.large') },
  ];

  const chatWidths: { id: ChatWidth; label: string }[] = [
    { id: 'small', label: t('settings.chatWidth.small') },
    { id: 'medium', label: t('settings.chatWidth.medium') },
    { id: 'large', label: t('settings.chatWidth.large') },
    { id: 'full', label: t('settings.chatWidth.full') },
  ];

  return (
    <div className="settings-section">
      <div className="settings-row">
        <label className="settings-label">{t('settings.language.title')}</label>
        <div className="settings-control">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.theme.title')}</label>
        <div className="settings-control">
          <select 
            value={theme} 
            onChange={(e) => setTheme(e.target.value as Theme)}
            className="settings-select"
          >
            {themes.map((themeOption) => (
              <option key={themeOption.id} value={themeOption.id}>
                {themeOption.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.textScale.title')}</label>
        <div className="settings-control">
          <select 
            value={textScale} 
            onChange={(e) => setTextScale(e.target.value as TextScale)}
            className="settings-select"
          >
            {textScales.map((scaleOption) => (
              <option key={scaleOption.id} value={scaleOption.id}>
                {scaleOption.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.chatWidth.title')}</label>
        <div className="settings-control">
          <select 
            value={chatWidth} 
            onChange={(e) => setChatWidth(e.target.value as ChatWidth)}
            className="settings-select"
          >
            {chatWidths.map((widthOption) => (
              <option key={widthOption.id} value={widthOption.id}>
                {widthOption.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.markdown.title')}</label>
        <div className="settings-control">
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={markdownEnabled}
              onChange={(e) => setMarkdownEnabled(e.target.checked)}
              className="settings-toggle-input"
            />
            <span className="settings-toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettings;
