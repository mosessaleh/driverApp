import { useTranslation as useI18nTranslation } from 'react-i18next';

export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();

  const changeLanguage = (language: 'en' | 'ar' | 'da') => {
    i18n.changeLanguage(language);
  };

  const getCurrentLanguage = () => {
    return i18n.language as 'en' | 'ar' | 'da';
  };

  return {
    t,
    changeLanguage,
    getCurrentLanguage,
    isRTL: i18n.language === 'ar',
  };
};