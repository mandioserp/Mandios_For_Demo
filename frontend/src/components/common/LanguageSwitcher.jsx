import { useLanguage } from '../../context/LanguageContext.jsx';

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === 'ur' ? 'en' : 'ur';

  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${className}`}
      onClick={() => setLanguage(nextLanguage)}
      aria-label={language === 'ur' ? 'Switch language to English' : 'زبان اردو میں تبدیل کریں'}
      lang={nextLanguage}
    >
      {language === 'ur' ? 'English' : 'اردو'}
    </button>
  );
}
