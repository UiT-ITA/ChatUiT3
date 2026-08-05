import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import type { SettingsCategory } from '../../types/settingsModels';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { tab } = useParams<{ tab?: string }>();
  const { settings, updateSetting, exportData, deleteAllData } = useSettings();

  const activeTab: SettingsCategory =
    tab === 'personalization' || tab === 'dataControl' ? tab : 'appearance';

  return (
    <div className="settings-page">
      <div className="settings-page-content">
        <h1 className="t-page-title">{t(`settings.categories.${activeTab}`)}</h1>
        <div className="page-title-bar" />

        {activeTab === 'appearance' && (
          <>
            <div className="settings-overline t-overline">{t('settings.theme.title')}</div>
            <div className="settings-card-grid">
              <button
                className={`settings-theme-card ${settings.theme === 'blue' ? 'active' : ''}`}
                onClick={() => updateSetting('theme', 'blue')}
              >
                <span className="settings-theme-preview" data-preview-theme="blue">
                  <span className="settings-theme-preview-rail" />
                  <span className="settings-theme-preview-line settings-theme-preview-line-1" />
                  <span className="settings-theme-preview-line settings-theme-preview-line-2" />
                  <span className="settings-theme-preview-accent" />
                </span>
                <span className="settings-card-label t-ui">{t('settings.theme.blue')}</span>
              </button>
              <button
                className={`settings-theme-card ${settings.theme === 'grey' ? 'active' : ''}`}
                onClick={() => updateSetting('theme', 'grey')}
              >
                <span className="settings-theme-preview" data-preview-theme="grey">
                  <span className="settings-theme-preview-rail" />
                  <span className="settings-theme-preview-line settings-theme-preview-line-1" />
                  <span className="settings-theme-preview-line settings-theme-preview-line-2" />
                  <span className="settings-theme-preview-accent" />
                </span>
                <span className="settings-card-label t-ui">{t('settings.theme.grey')}</span>
              </button>
            </div>

            <div className="settings-overline t-overline">{t('settings.mode.title')}</div>
            <div className="settings-card-grid">
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <button
                  key={mode}
                  className={`settings-theme-card ${settings.mode === mode ? 'active' : ''}`}
                  onClick={() => updateSetting('mode', mode)}
                >
                  <span className="settings-theme-preview" data-preview-mode={mode} data-preview-theme={settings.theme}>
                    <span className="settings-theme-preview-rail" />
                    <span className="settings-theme-preview-line settings-theme-preview-line-1" />
                    <span className="settings-theme-preview-line settings-theme-preview-line-2" />
                    <span className="settings-theme-preview-accent" />
                  </span>
                  <span className="settings-card-label t-ui">{t(`settings.mode.${mode}`)}</span>
                </button>
              ))}
            </div>

            <div className="settings-overline t-overline">{t('settings.textScale.title')}</div>
            <div className="settings-option-row">
              {(['small', 'medium', 'large', 'xl'] as const).map((size) => (
                <button
                  key={size}
                  className={`settings-pill-option ${settings.size === size ? 'active' : ''}`}
                  onClick={() => updateSetting('size', size)}
                >
                  {t(`settings.textScale.${size === 'xl' ? 'extraLarge' : size}`)}
                </button>
              ))}
            </div>

            <div className="settings-overline t-overline">{t('settings.language.title')}</div>
            <div className="settings-option-row">
              <button
                className={`settings-pill-option ${settings.language === 'en-US' ? 'active' : ''}`}
                onClick={() => updateSetting('language', 'en-US')}
              >
                <img src="/gb.svg" alt="" className="settings-flag" />
                English
              </button>
              <button
                className={`settings-pill-option ${settings.language === 'no-NB' ? 'active' : ''}`}
                onClick={() => updateSetting('language', 'no-NB')}
              >
                <img src="/no.svg" alt="" className="settings-flag" />
                Norsk
              </button>
            </div>
          </>
        )}

        {activeTab === 'personalization' && (
          <>
            <div className="settings-field">
              <label className="settings-label t-label">{t('settings.personalization.name.title')}</label>
              <input
                type="text"
                value={settings.userName}
                onChange={(e) => updateSetting('userName', e.target.value)}
                placeholder={t('settings.personalization.name.placeholder')}
                className="settings-input t-body"
              />
            </div>

            <div className="settings-field">
              <label className="settings-label t-label">{t('settings.personalization.jobRole.title')}</label>
              <input
                type="text"
                value={settings.jobRole}
                onChange={(e) => updateSetting('jobRole', e.target.value)}
                placeholder={t('settings.personalization.jobRole.placeholder')}
                className="settings-input t-body"
              />
            </div>

            <div className="settings-field">
              <label className="settings-label t-label">{t('settings.personalization.responseStyle.title')}</label>
              <select
                value={settings.responseStyle}
                onChange={(e) => updateSetting('responseStyle', e.target.value as typeof settings.responseStyle)}
                className="settings-select t-body"
              >
                <option value="creative">{t('settings.personalization.responseStyle.creative')}</option>
                <option value="balanced">{t('settings.personalization.responseStyle.balanced')}</option>
                <option value="precise">{t('settings.personalization.responseStyle.precise')}</option>
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label t-label">{t('settings.personalization.responseLength.title')}</label>
              <select
                value={settings.responseLength}
                onChange={(e) => updateSetting('responseLength', e.target.value as typeof settings.responseLength)}
                className="settings-select t-body"
              >
                <option value="short">{t('settings.personalization.responseLength.short')}</option>
                <option value="medium">{t('settings.personalization.responseLength.medium')}</option>
                <option value="long">{t('settings.personalization.responseLength.long')}</option>
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-label t-label">{t('settings.personalization.customInstructions.title')}</label>
              <textarea
                value={settings.customInstructions}
                onChange={(e) => updateSetting('customInstructions', e.target.value)}
                placeholder={t('settings.personalization.customInstructions.placeholder')}
                className="settings-textarea t-body"
                rows={4}
              />
            </div>
          </>
        )}

        {activeTab === 'dataControl' && (
          <>
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label t-table-strong">{t('settings.dataControl.retentionPeriod.title')}</div>
              </div>
              <select
                value={settings.chatRetentionPeriod}
                onChange={(e) => updateSetting('chatRetentionPeriod', e.target.value as typeof settings.chatRetentionPeriod)}
                className="settings-select settings-select-inline t-body"
              >
                <option value="1week">{t('settings.dataControl.retentionPeriod.1week')}</option>
                <option value="1month">{t('settings.dataControl.retentionPeriod.1month')}</option>
                <option value="3months">{t('settings.dataControl.retentionPeriod.3months')}</option>
                <option value="1year">{t('settings.dataControl.retentionPeriod.1year')}</option>
                <option value="forever">{t('settings.dataControl.retentionPeriod.forever')}</option>
              </select>
            </div>

            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label t-table-strong">{t('settings.dataControl.autoDelete.title')}</div>
              </div>
              <button
                className={`settings-toggle ${settings.autoDeleteOldChats ? 'on' : ''}`}
                onClick={() => updateSetting('autoDeleteOldChats', !settings.autoDeleteOldChats)}
                aria-label={t('settings.dataControl.autoDelete.title')}
                aria-pressed={settings.autoDeleteOldChats}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label t-table-strong">{t('settings.dataControl.exportFormat.title')}</div>
              </div>
              <select
                value={settings.exportFormat}
                onChange={(e) => updateSetting('exportFormat', e.target.value as typeof settings.exportFormat)}
                className="settings-select settings-select-inline t-body"
              >
                <option value="json">{t('settings.dataControl.exportFormat.json')}</option>
                <option value="markdown">{t('settings.dataControl.exportFormat.markdown')}</option>
                <option value="txt">{t('settings.dataControl.exportFormat.txt')}</option>
              </select>
            </div>

            <div className="settings-actions">
              <button
                onClick={() => exportData(settings.exportFormat)}
                className="settings-button-secondary t-ui"
              >
                {t('settings.dataControl.exportData.button')}
              </button>
              <button
                onClick={deleteAllData}
                className="settings-button-danger t-ui"
              >
                {t('settings.dataControl.deleteAll.button')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
