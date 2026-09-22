export interface AppSettings {
  // Appearance
  theme: 'blue' | 'grey';
  mode: 'light' | 'dark' | 'system';
  size: 'small' | 'medium' | 'large' | 'xl';
  language: 'en-US' | 'no-NB';
  
  // Personalization lives server-side, see userProfileService

  // Data Control
  chatRetentionPeriod: '1week' | '1month' | '3months' | '1year' | 'forever';
  autoDeleteOldChats: boolean;
  exportFormat: 'json' | 'markdown' | 'txt';
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Appearance
  theme: 'blue',
  mode: 'system',
  size: 'medium',
  language: 'en-US',
  
  // Data Control
  chatRetentionPeriod: 'forever',
  autoDeleteOldChats: false,
  exportFormat: 'json',
};

export type SettingsCategory = 'appearance' | 'personalization' | 'dataControl';
