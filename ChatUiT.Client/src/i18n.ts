import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en/translation.json';
import noTranslation from './locales/no/translation.json';

const resources = {
  'en-US': {
    translation: enTranslation,
  },
  'no-NB': {
    translation: noTranslation,
  },
};

let isInitialized = false;

export const initializeI18n = async (language: string): Promise<void> => {
  if (isInitialized) {
    await i18n.changeLanguage(language);
    return;
  }

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      fallbackLng: 'en-US',
      interpolation: {
        escapeValue: false,
      },
    });

  isInitialized = true;
};

export default i18n;
