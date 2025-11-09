import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { es } from './locales/es';
import { en } from './locales/en';
import { pt } from './locales/pt';
import { detectLanguageByCountry } from '@/lib/languageDetection';

// Custom language detector that prioritizes country-based detection
const customDetector = {
  name: 'customDetector',
  
  async: true,
  
  async detect(callback: (lang: string) => void) {
    // Check if user has manually selected a language before
    const savedLanguage = localStorage.getItem('i18nextLng');
    
    if (savedLanguage && savedLanguage !== 'undefined') {
      // User has previously selected a language, use that
      callback(savedLanguage);
      return;
    }
    
    // No saved preference, detect from country
    const detectedLanguage = await detectLanguageByCountry();
    
    if (detectedLanguage) {
      callback(detectedLanguage);
    } else {
      // Fallback to browser language
      const browserLang = navigator.language.split('-')[0];
      callback(['es', 'en', 'pt'].includes(browserLang) ? browserLang : 'es');
    }
  },
  
  cacheUserLanguage(lng: string) {
    localStorage.setItem('i18nextLng', lng);
  }
};

i18n
  .use({
    type: 'languageDetector',
    ...customDetector
  } as any)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      pt: { translation: pt },
    },
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
