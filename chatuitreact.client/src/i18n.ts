import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: [],
      caches: [],
    },
  });

export default i18n;
