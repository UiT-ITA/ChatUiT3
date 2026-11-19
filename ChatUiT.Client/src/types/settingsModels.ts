export interface AppSettings {
  // Theme, colour scheme and text size are ui-sdk preferences, see services/appearance
  language: 'en-US' | 'no-NB';
  
  // Personalization lives server-side, see userProfileService

  // Data Control
  chatRetentionPeriod: '1week' | '1month' | '3months' | '1year' | 'forever';
  autoDeleteOldChats: boolean;
  exportFormat: 'json' | 'markdown' | 'txt';

  // How the assistant page shows assistants
  assistantView: 'cards' | 'list';
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en-US',
  
  // Data Control
  chatRetentionPeriod: 'forever',
  autoDeleteOldChats: false,
  exportFormat: 'json',

  assistantView: 'cards',
};

export type SettingsCategory = 'appearance' | 'personalization' | 'dataControl';

/** The settings tabs, in the order the side column lists them. */
export const SETTINGS_TABS: SettingsCategory[] = ['appearance', 'personalization', 'dataControl'];

/** The settings tab of a route segment, or the first tab. */
export const settingsTab = (segment: string | undefined): SettingsCategory =>
  SETTINGS_TABS.includes(segment as SettingsCategory) ? segment as SettingsCategory : 'appearance';
