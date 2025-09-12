import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { Dialog, DialogPage } from '../common/Dialog';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { settings, updateSetting, exportData, deleteAllData } = useSettings();

  useEffect(() => {
    // Apply theme data attributes to let CSS cascade naturally
    if (isOpen) {
      setTimeout(() => {
        const lightOption = document.querySelector('.theme-option[data-theme="light"]');
        const dimOption = document.querySelector('.theme-option[data-theme="dim"]');
        const darkOption = document.querySelector('.theme-option[data-theme="dark"]');

        // Apply theme attributes to let your existing CSS variables work
        if (lightOption) {
          lightOption.setAttribute('data-theme', 'light');
        }
        if (dimOption) {
          dimOption.setAttribute('data-theme', 'dim');
        }
        if (darkOption) {
          darkOption.setAttribute('data-theme', 'dark');
        }
      }, 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.title')}
      size="large"
    >
      {/* Appearance Page */}
      <DialogPage id="appearance" label={t('settings.categories.appearance')} icon="settings">
        <div className="settings-section">
          <div className="setting-group">
            <label className="setting-label">{t('settings.theme.title')}</label>
            <div className="theme-selector">
              <div
                className={`theme-option ${settings.theme === 'light' ? 'active' : ''}`}
                onClick={() => updateSetting('theme', 'light')}
                data-theme="light"
              >
                <div className="theme-preview">{t('settings.preview.sample')}</div>
                <span className="theme-label">{t('settings.theme.light')}</span>
              </div>
              
              <div
                className={`theme-option ${settings.theme === 'dim' ? 'active' : ''}`}
                onClick={() => updateSetting('theme', 'dim')}
                data-theme="dim"
              >
                <div className="theme-preview">{t('settings.preview.sample')}</div>
                <span className="theme-label">{t('settings.theme.altDark')}</span>
              </div>
              
              <div
                className={`theme-option ${settings.theme === 'dark' ? 'active' : ''}`}
                onClick={() => updateSetting('theme', 'dark')}
                data-theme="dark"
              >
                <div className="theme-preview">{t('settings.preview.sample')}</div>
                <span className="theme-label">{t('settings.theme.dark')}</span>
              </div>
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.textScale.title')}</label>
            <div className="size-selector">
              <div
                className={`size-option ${settings.size === 'small' ? 'active' : ''}`}
                onClick={() => updateSetting('size', 'small')}
                data-size="small"
              >
                <div className="size-preview">{t('settings.preview.sampleText')}</div>
                <span className="size-label">{t('settings.textScale.small')}</span>
              </div>
              
              <div
                className={`size-option ${settings.size === 'medium' ? 'active' : ''}`}
                onClick={() => updateSetting('size', 'medium')}
                data-size="medium"
              >
                <div className="size-preview">{t('settings.preview.sampleText')}</div>
                <span className="size-label">{t('settings.textScale.medium')}</span>
              </div>
              
              <div
                className={`size-option ${settings.size === 'large' ? 'active' : ''}`}
                onClick={() => updateSetting('size', 'large')}
                data-size="large"
              >
                <div className="size-preview">{t('settings.preview.sampleText')}</div>
                <span className="size-label">{t('settings.textScale.large')}</span>
              </div>
              
              <div
                className={`size-option ${settings.size === 'xl' ? 'active' : ''}`}
                onClick={() => updateSetting('size', 'xl')}
                data-size="xl"
              >
                <div className="size-preview">{t('settings.preview.sampleText')}</div>
                <span className="size-label">{t('settings.textScale.extraLarge')}</span>
              </div>
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.language.title')}</label>
            <div className="language-selector">
              <div
                className={`language-option ${settings.language === 'en-US' ? 'active' : ''}`}
                onClick={() => updateSetting('language', 'en-US')}
              >
                <img src="/gb.svg" alt="English" className="flag-icon" />
                <span className="language-label">English</span>
              </div>
              
              <div
                className={`language-option ${settings.language === 'no-NB' ? 'active' : ''}`}
                onClick={() => updateSetting('language', 'no-NB')}
              >
                <img src="/no.svg" alt="Norwegian" className="flag-icon" />
                <span className="language-label">Norsk</span>
              </div>
            </div>
          </div>
        </div>
      </DialogPage>

      {/* Personalization Page */}
      <DialogPage id="personalization" label={t('settings.categories.personalization')} icon="user">
        <div className="settings-section">
          <div className="setting-group">
            <label className="setting-label">{t('settings.personalization.name.title')}</label>
            <input
              type="text"
              value={settings.userName}
              onChange={(e) => updateSetting('userName', e.target.value)}
              placeholder={t('settings.personalization.name.placeholder')}
              className="setting-input"
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.personalization.jobRole.title')}</label>
            <input
              type="text"
              value={settings.jobRole}
              onChange={(e) => updateSetting('jobRole', e.target.value)}
              placeholder={t('settings.personalization.jobRole.placeholder')}
              className="setting-input"
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.personalization.responseStyle.title')}</label>
            <select
              value={settings.responseStyle}
              onChange={(e) => updateSetting('responseStyle', e.target.value as any)}
              className="setting-select"
            >
              <option value="creative">{t('settings.personalization.responseStyle.creative')}</option>
              <option value="balanced">{t('settings.personalization.responseStyle.balanced')}</option>
              <option value="precise">{t('settings.personalization.responseStyle.precise')}</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.personalization.responseLength.title')}</label>
            <select
              value={settings.responseLength}
              onChange={(e) => updateSetting('responseLength', e.target.value as any)}
              className="setting-select"
            >
              <option value="short">{t('settings.personalization.responseLength.short')}</option>
              <option value="medium">{t('settings.personalization.responseLength.medium')}</option>
              <option value="long">{t('settings.personalization.responseLength.long')}</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.personalization.customInstructions.title')}</label>
            <textarea
              value={settings.customInstructions}
              onChange={(e) => updateSetting('customInstructions', e.target.value)}
              placeholder={t('settings.personalization.customInstructions.placeholder')}
              className="setting-textarea"
              rows={4}
            />
          </div>
        </div>
      </DialogPage>

      {/* Data Control Page */}
      <DialogPage id="dataControl" label={t('settings.categories.dataControl')} icon="admin">
        <div className="settings-section">
          <div className="setting-group">
            <label className="setting-label">{t('settings.dataControl.retentionPeriod.title')}</label>
            <select
              value={settings.chatRetentionPeriod}
              onChange={(e) => updateSetting('chatRetentionPeriod', e.target.value as any)}
              className="setting-select"
            >
              <option value="1week">{t('settings.dataControl.retentionPeriod.1week')}</option>
              <option value="1month">{t('settings.dataControl.retentionPeriod.1month')}</option>
              <option value="3months">{t('settings.dataControl.retentionPeriod.3months')}</option>
              <option value="1year">{t('settings.dataControl.retentionPeriod.1year')}</option>
              <option value="forever">{t('settings.dataControl.retentionPeriod.forever')}</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={settings.autoDeleteOldChats}
                onChange={(e) => updateSetting('autoDeleteOldChats', e.target.checked)}
                className="setting-checkbox"
              />
              {t('settings.dataControl.autoDelete.title')}
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.dataControl.exportFormat.title')}</label>
            <select
              value={settings.exportFormat}
              onChange={(e) => updateSetting('exportFormat', e.target.value as any)}
              className="setting-select"
            >
              <option value="json">{t('settings.dataControl.exportFormat.json')}</option>
              <option value="markdown">{t('settings.dataControl.exportFormat.markdown')}</option>
              <option value="txt">{t('settings.dataControl.exportFormat.txt')}</option>
            </select>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.dataControl.exportData.title')}</label>
            <button
              onClick={() => exportData(settings.exportFormat)}
              className="setting-button setting-button-primary"
            >
              {t('settings.dataControl.exportData.button')}
            </button>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.dataControl.deleteAll.title')}</label>
            <button
              onClick={deleteAllData}
              className="setting-button setting-button-danger"
            >
              {t('settings.dataControl.deleteAll.button')}
            </button>
          </div>
        </div>
      </DialogPage>
    </Dialog>
  );
};

export default SettingsModal;
