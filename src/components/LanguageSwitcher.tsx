import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Language, languageFlags } from '@/data/translations';
import { cn } from '@/lib/utils';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const languages: Language[] = ['pt', 'en', 'ja'];

  return (
    <div className="flex items-center gap-1">
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={cn(
            "text-xl p-1 rounded-md transition-all duration-200 hover:scale-110",
            language === lang
              ? "bg-primary/15 ring-2 ring-primary/40 scale-110"
              : "opacity-60 hover:opacity-100"
          )}
          title={lang === 'pt' ? 'Português' : lang === 'en' ? 'English' : '日本語'}
          aria-label={`Switch to ${lang === 'pt' ? 'Portuguese' : lang === 'en' ? 'English' : 'Japanese'}`}
        >
          {languageFlags[lang]}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
