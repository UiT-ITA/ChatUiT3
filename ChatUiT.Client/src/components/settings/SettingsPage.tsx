import React, { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../hooks/useSettings';
import type { SettingsCategory } from '../../types/settingsModels';
import { getUserProfile, updateUserProfile, type UserProfile } from '../../services/userProfileService';
import Select from '../common/Select';
import TextInput from '../common/TextInput';
import TextArea from '../common/TextArea';
import Toggle from '../common/Toggle';
import Button from '../common/Button';
import Stack from '../common/Stack';
import Card from '../common/Card';
import SegmentedControl from '../common/SegmentedControl';
import './SettingsPage.css';

interface ProfileFieldProps {
  field: keyof UserProfile;
  profile: UserProfile;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

// Edits locally and saves to the server on blur, so a keystroke is not a request.
const ProfileField: React.FC<ProfileFieldProps> = ({ field, profile, label, placeholder, multiline }) => {
  const [draft, setDraft] = useState(profile[field]);
  const [synced, setSynced] = useState(profile[field]);
  if (profile[field] !== synced) {
    setSynced(profile[field]);
    setDraft(profile[field]);
  }

  const save = () => {
    if (draft !== profile[field]) {
      updateUserProfile({ [field]: draft }).catch((error) => console.error('Failed to save profile:', error));
    }
  };

  return multiline ? (
    <TextArea
      label={label}
      maxWidth="34rem"
      value={draft}
      onChange={(value) => setDraft(value)}
      onBlur={save}
      placeholder={placeholder}
      rows={4}
    />
  ) : (
    <TextInput
      label={label}
      maxWidth="34rem"
      type="text"
      value={draft}
      onChange={(value) => setDraft(value)}
      onBlur={save}
      placeholder={placeholder}
    />
  );
};

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { tab } = useParams<{ tab?: string }>();
  const { settings, updateSetting, exportData, deleteAllData } = useSettings();
  useSignals();
  const profile = getUserProfile().value;

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
              <Card
                as="button"
                padding="sm"
                selected={settings.theme === 'blue'}
                onClick={() => updateSetting('theme', 'blue')}
              >
                <span className="settings-theme-preview" data-preview-theme="blue">
                  <span className="settings-theme-preview-rail" />
                  <span className="settings-theme-preview-line settings-theme-preview-line-1" />
                  <span className="settings-theme-preview-line settings-theme-preview-line-2" />
                  <span className="settings-theme-preview-accent" />
                </span>
                <span className="t-ui">{t('settings.theme.blue')}</span>
              </Card>
              <Card
                as="button"
                padding="sm"
                selected={settings.theme === 'grey'}
                onClick={() => updateSetting('theme', 'grey')}
              >
                <span className="settings-theme-preview" data-preview-theme="grey">
                  <span className="settings-theme-preview-rail" />
                  <span className="settings-theme-preview-line settings-theme-preview-line-1" />
                  <span className="settings-theme-preview-line settings-theme-preview-line-2" />
                  <span className="settings-theme-preview-accent" />
                </span>
                <span className="t-ui">{t('settings.theme.grey')}</span>
              </Card>
            </div>

            <div className="settings-overline t-overline">{t('settings.mode.title')}</div>
            <div className="settings-card-grid">
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <Card
                  key={mode}
                  as="button"
                  padding="sm"
                  selected={settings.mode === mode}
                  onClick={() => updateSetting('mode', mode)}
                >
                  <span className="settings-theme-preview" data-preview-mode={mode} data-preview-theme={settings.theme}>
                    <span className="settings-theme-preview-rail" />
                    <span className="settings-theme-preview-line settings-theme-preview-line-1" />
                    <span className="settings-theme-preview-line settings-theme-preview-line-2" />
                    <span className="settings-theme-preview-accent" />
                  </span>
                  <span className="t-ui">{t(`settings.mode.${mode}`)}</span>
                </Card>
              ))}
            </div>

            <div className="settings-overline t-overline">{t('settings.textScale.title')}</div>
            <SegmentedControl
              label={t('settings.textScale.title')}
              value={settings.size}
              onChange={(size) => updateSetting('size', size)}
              options={(['small', 'medium', 'large', 'xl'] as const).map((size) => ({
                value: size,
                label: t(`settings.textScale.${size === 'xl' ? 'extraLarge' : size}`),
              }))}
            />

            <div className="settings-overline t-overline">{t('settings.language.title')}</div>
            <SegmentedControl
              label={t('settings.language.title')}
              value={settings.language}
              onChange={(language) => updateSetting('language', language)}
              options={[
                { value: 'en-US', label: 'English', leading: <img src="/gb.svg" alt="" className="settings-flag" /> },
                { value: 'no-NB', label: 'Norsk', leading: <img src="/no.svg" alt="" className="settings-flag" /> },
              ]}
            />
          </>
        )}

        {activeTab === 'personalization' && profile && (
          <Stack gap="xl">
            <ProfileField
              field="displayName"
              profile={profile}
              label={t('settings.personalization.name.title')}
              placeholder={t('settings.personalization.name.placeholder')}
            />

            <ProfileField
              field="jobRole"
              profile={profile}
              label={t('settings.personalization.jobRole.title')}
              placeholder={t('settings.personalization.jobRole.placeholder')}
            />

            <ProfileField
              field="answerPreferences"
              profile={profile}
              label={t('settings.personalization.customInstructions.title')}
              placeholder={t('settings.personalization.customInstructions.placeholder')}
              multiline
            />
          </Stack>
        )}

        {activeTab === 'dataControl' && (
          <>
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label t-table-strong">{t('settings.dataControl.retentionPeriod.title')}</div>
              </div>
              <Select
                value={settings.chatRetentionPeriod}
                onChange={(value) => updateSetting('chatRetentionPeriod', value as typeof settings.chatRetentionPeriod)}
                inline
                minWidth="10rem"
              >
                <option value="1week">{t('settings.dataControl.retentionPeriod.1week')}</option>
                <option value="1month">{t('settings.dataControl.retentionPeriod.1month')}</option>
                <option value="3months">{t('settings.dataControl.retentionPeriod.3months')}</option>
                <option value="1year">{t('settings.dataControl.retentionPeriod.1year')}</option>
                <option value="forever">{t('settings.dataControl.retentionPeriod.forever')}</option>
              </Select>
            </div>

            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label t-table-strong">{t('settings.dataControl.autoDelete.title')}</div>
              </div>
              <Toggle
                checked={settings.autoDeleteOldChats}
                onChange={(checked) => updateSetting('autoDeleteOldChats', checked)}
                aria-label={t('settings.dataControl.autoDelete.title')}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-row-label t-table-strong">{t('settings.dataControl.exportFormat.title')}</div>
              </div>
              <Select
                value={settings.exportFormat}
                onChange={(value) => updateSetting('exportFormat', value as typeof settings.exportFormat)}
                inline
                minWidth="10rem"
              >
                <option value="json">{t('settings.dataControl.exportFormat.json')}</option>
                <option value="markdown">{t('settings.dataControl.exportFormat.markdown')}</option>
                <option value="txt">{t('settings.dataControl.exportFormat.txt')}</option>
              </Select>
            </div>

            <div className="settings-actions">
              <Button variant="secondary" onClick={() => exportData(settings.exportFormat)}>
                {t('settings.dataControl.exportData.button')}
              </Button>
              <Button variant="danger" onClick={deleteAllData}>
                {t('settings.dataControl.deleteAll.button')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
