import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { kk } from './locales/kk';
import { ru } from './locales/ru';
import { en } from './locales/en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { kk, ru, en },
    supportedLngs: ['kk', 'ru', 'en'],
    fallbackLng: 'ru',
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
});

export default i18n;
