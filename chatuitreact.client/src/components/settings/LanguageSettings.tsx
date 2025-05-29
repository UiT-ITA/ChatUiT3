import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSettings: React.FC = () => {
  const { t, i18n } = useTranslation();

  const languages = [
    {
      code: 'en-US',
      label: 'English',
      nativeLabel: 'English',
    },
    {
      code: 'no-NB',
      label: 'Norwegian',
      nativeLabel: 'Norsk',
    },
  ];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <div className="settings-section">
      <div className="settings-group">
        <h3 className="settings-group-title">{t('settings.language.title')}</h3>
        <p className="settings-group-description">{t('settings.language.description')}</p>
        
        <div className="settings-options">
          {languages.map((language) => (
            <label key={language.code} className="settings-option">
              <input
                type="radio"
                name="language"
                value={language.code}
                checked={i18n.language === language.code}
                onChange={() => handleLanguageChange(language.code)}
                className="settings-option-input"
              />
              <div className="settings-option-content">
                <div className="settings-option-label">{language.label}</div>
                <div className="settings-option-description">{language.nativeLabel}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageSettings;
