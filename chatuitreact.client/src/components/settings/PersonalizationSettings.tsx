import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const PersonalizationSettings: React.FC = () => {
  const { t } = useTranslation();
  
  // Dummy state for personalization settings
  const [name, setName] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [responseStyle, setResponseStyle] = useState('balanced');
  const [customInstructions, setCustomInstructions] = useState('');
  const [responseLength, setResponseLength] = useState('medium');

  const responseStyles = [
    { id: 'creative', label: t('settings.personalization.responseStyle.creative') },
    { id: 'balanced', label: t('settings.personalization.responseStyle.balanced') },
    { id: 'precise', label: t('settings.personalization.responseStyle.precise') },
  ];

  const responseLengths = [
    { id: 'short', label: t('settings.personalization.responseLength.short') },
    { id: 'medium', label: t('settings.personalization.responseLength.medium') },
    { id: 'long', label: t('settings.personalization.responseLength.long') },
  ];

  return (
    <div className="settings-section">
      <div className="settings-row">
        <label className="settings-label">{t('settings.personalization.name.title')}</label>
        <div className="settings-control">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.personalization.name.placeholder')}
            className="settings-input"
          />
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.personalization.jobRole.title')}</label>
        <div className="settings-control">
          <input
            type="text"
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value)}
            placeholder={t('settings.personalization.jobRole.placeholder')}
            className="settings-input"
          />
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.personalization.responseStyle.title')}</label>
        <div className="settings-control">
          <select 
            value={responseStyle} 
            onChange={(e) => setResponseStyle(e.target.value)}
            className="settings-select"
          >
            {responseStyles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-row">
        <label className="settings-label">{t('settings.personalization.responseLength.title')}</label>
        <div className="settings-control">
          <select 
            value={responseLength} 
            onChange={(e) => setResponseLength(e.target.value)}
            className="settings-select"
          >
            {responseLengths.map((length) => (
              <option key={length.id} value={length.id}>
                {length.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-row settings-row-vertical">
        <label className="settings-label">{t('settings.personalization.customInstructions.title')}</label>
        <div className="settings-control">
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder={t('settings.personalization.customInstructions.placeholder')}
            className="settings-textarea"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
};

export default PersonalizationSettings;
