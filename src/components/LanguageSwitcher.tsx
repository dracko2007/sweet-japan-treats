import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Language } from '@/data/translations';
import { cn } from '@/lib/utils';
import FlagIcon from '@/components/FlagIcon';

const LANG_FLAGS: Record<Language, { code: string; label: string }> = {
  pt: { code: 'br', label: 'Português' },
  en: { code: 'us', label: 'English' },
  ja: { code: 'jp', label: '日本語' },
};

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const languages: Language[] = ['pt', 'en', 'ja'];

  return (
    <div className="flex items-center gap-1">
      {languages.map((lang) => {
        const { code, label } = LANG_FLAGS[lang];
        return (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={cn(
              "p-1 rounded-md transition-all duration-200 hover:scale-110",
              language === lang
                ? "bg-primary/15 ring-2 ring-primary/40 scale-110"
                : "opacity-60 hover:opacity-100"
            )}
            title={label}
            aria-label={`Switch to ${label}`}
          >
            <FlagIcon code={code} alt={label} size={22} />
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
