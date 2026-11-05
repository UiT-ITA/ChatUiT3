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
import SegmentedControl from '../common/SegmentedControl';
import { ConfirmDialog } from '../common/Dialog';
import { resolveMode } from '../../utils/themeUtils';
import PageTitleBar from '../common/PageTitleBar';
import Page from '../common/Page';
import Text from '../common/Text';
import Grid from '../common/Grid';
import ChoiceCard from '../common/ChoiceCard';
import SectionLabel from '../common/SectionLabel';
import SettingRow from '../common/SettingRow';
import Flag from '../common/Flag';
import { cx } from '../common/layout';
import './SettingsPage.css';

/** A miniature of the app in a theme and mode; 'system' shows the light scene with the dark scene over its right half. */
const ThemePreview: React.FC<{ theme: 'blue' | 'grey'; mode: 'light' | 'dark' | 'system' }> = ({ theme, mode }) => (
  <span className="theme-preview">
    {(mode === 'system' ? ['light', 'dark'] : [mode]).map((sceneMode) => (
      <span
        key={sceneMode}
        className={cx('theme-preview__scene', mode === 'system' && sceneMode === 'dark' && 'theme-preview__scene--dark-half')}
        data-theme={theme}
        data-mode={sceneMode}
      >
        <span className="theme-preview__rail" />
        <span className="theme-preview__bar theme-preview__bar--1" />
        <span className="theme-preview__bar theme-preview__bar--2" />
        <span className="theme-preview__button" />
      </span>
    ))}
  </span>
);

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

  const props = { label, placeholder, maxWidth: 'md' as const, value: draft, onChange: setDraft, onBlur: save };
  return multiline ? <TextArea {...props} rows={4} /> : <TextInput {...props} />;
};

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { tab } = useParams<{ tab?: string }>();
  const { settings, updateSetting, exportData, deleteAllData } = useSettings();
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  useSignals();
  const profile = getUserProfile().value;

  const activeTab: SettingsCategory =
    tab === 'personalization' || tab === 'dataControl' ? tab : 'appearance';

  return (
    <Page fill="grow" flow="block">
      <Text as="h1" variant="page-title">{t(`settings.categories.${activeTab}`)}</Text>
      <PageTitleBar />

      {activeTab === 'appearance' && (
        <>
          <SectionLabel hint={t('settings.theme.description')}>{t('settings.theme.title')}</SectionLabel>
          <Grid columns={2} gap="md">
            {(['blue', 'grey'] as const).map((theme) => (
              <ChoiceCard
                key={theme}
                label={t(`settings.theme.${theme}`)}
                selected={settings.theme === theme}
                onSelect={() => updateSetting('theme', theme)}
              >
                <ThemePreview theme={theme} mode={resolveMode(settings.mode)} />
              </ChoiceCard>
            ))}
          </Grid>

          <SectionLabel hint={t('settings.mode.description')}>{t('settings.mode.title')}</SectionLabel>
          <Grid columns={3} narrowColumns={2} gap="md">
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <ChoiceCard
                key={mode}
                label={t(`settings.mode.${mode}`)}
                selected={settings.mode === mode}
                onSelect={() => updateSetting('mode', mode)}
              >
                <ThemePreview theme={settings.theme} mode={mode} />
              </ChoiceCard>
            ))}
          </Grid>

          <SectionLabel>{t('settings.textScale.title')}</SectionLabel>
          <SegmentedControl
            label={t('settings.textScale.title')}
            stretch
            value={settings.size}
            onChange={(size) => updateSetting('size', size)}
            options={(['small', 'medium', 'large', 'xl'] as const).map((size) => ({
              value: size,
              label: t(`settings.textScale.${size === 'xl' ? 'extraLarge' : size}`),
            }))}
          />

          <SectionLabel>{t('settings.language.title')}</SectionLabel>
          <SegmentedControl
            label={t('settings.language.title')}
            stretch
            maxWidth="sm"
            value={settings.language}
            onChange={(language) => updateSetting('language', language)}
            options={[
              { value: 'en-US', label: 'English', leading: <Flag src="/gb.svg" /> },
              { value: 'no-NB', label: 'Norsk', leading: <Flag src="/no.svg" /> },
            ]}
          />
        </>
      )}

      {activeTab === 'personalization' && profile && (
        <Stack gap="xl">
          {([['displayName', 'name'], ['jobRole', 'jobRole'], ['answerPreferences', 'customInstructions']] as const).map(([field, key]) => (
            <ProfileField
              key={field}
              field={field}
              profile={profile}
              label={t(`settings.personalization.${key}.title`)}
              placeholder={t(`settings.personalization.${key}.placeholder`)}
              multiline={field === 'answerPreferences'}
            />
          ))}
        </Stack>
      )}

      {activeTab === 'dataControl' && (
        <>
          <SettingRow label={t('settings.dataControl.retentionPeriod.title')}>
            <Select
              value={settings.chatRetentionPeriod}
              onChange={(value) => updateSetting('chatRetentionPeriod', value as typeof settings.chatRetentionPeriod)}
              inline
              minWidth="2xs"
            >
              {['1week', '1month', '3months', '1year', 'forever'].map((period) => (
                <option key={period} value={period}>{t(`settings.dataControl.retentionPeriod.${period}`)}</option>
              ))}
            </Select>
          </SettingRow>

          <SettingRow label={t('settings.dataControl.autoDelete.title')}>
            <Toggle
              checked={settings.autoDeleteOldChats}
              onChange={(checked) => updateSetting('autoDeleteOldChats', checked)}
              aria-label={t('settings.dataControl.autoDelete.title')}
            />
          </SettingRow>

          <SettingRow label={t('settings.dataControl.exportFormat.title')}>
            <Select
              value={settings.exportFormat}
              onChange={(value) => updateSetting('exportFormat', value as typeof settings.exportFormat)}
              inline
              minWidth="2xs"
            >
              {['json', 'markdown', 'txt'].map((format) => (
                <option key={format} value={format}>{t(`settings.dataControl.exportFormat.${format}`)}</option>
              ))}
            </Select>
          </SettingRow>

          <Stack direction="row" align="center" gap="md" mt="2xl" pt="xl" border borderSide="top">
            <Button variant="secondary" onClick={() => exportData(settings.exportFormat)}>
              {t('settings.dataControl.exportData.button')}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDeleteAll(true)}>
              {t('settings.dataControl.deleteAll.button')}
            </Button>
          </Stack>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteAll}
        title={t('settings.dataControl.deleteAll.title')}
        message={t('settings.dataControl.deleteAll.confirm')}
        confirmLabel={t('settings.dataControl.deleteAll.button')}
        onConfirm={deleteAllData}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </Page>
  );
};

export default SettingsPage;
