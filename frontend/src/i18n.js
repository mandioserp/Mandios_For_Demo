import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json' with { type: 'json' };
import ur from './locales/ur/translation.json' with { type: 'json' };

export function getLanguageDirection(language) {
  return language === 'ur' ? 'rtl' : 'ltr';
}

export function applyDocumentLanguage(language, documentRef) {
  const direction = getLanguageDirection(language);
  documentRef.documentElement.lang = language;
  documentRef.documentElement.dir = direction;
  documentRef.body.lang = language;
  documentRef.body.dir = direction;
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: typeof globalThis.localStorage === 'undefined'
    ? 'en'
    : globalThis.localStorage.getItem('mandi_language:guest') || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
