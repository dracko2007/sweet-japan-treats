import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { translations, Language } from '@/data/translations';
import { safeStorage } from '@/utils/storage';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  selectedCountry: 'Brasil' | 'Japão';
  setSelectedCountry: (country: 'Brasil' | 'Japão') => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = safeStorage.getItem('preferred-language');
    return (stored as Language) || 'pt';
  });

  const [selectedCountry, setSelectedCountryState] = useState<'Brasil' | 'Japão'>(() => {
    const stored = safeStorage.getItem('sakura_selected_country');
    return (stored as 'Brasil' | 'Japão') || 'Brasil';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    safeStorage.setItem('preferred-language', lang);
  }, []);

  const setSelectedCountry = useCallback((country: 'Brasil' | 'Japão') => {
    setSelectedCountryState(country);
    safeStorage.setItem('sakura_selected_country', country);
  }, []);

  const t = useCallback((key: string): string => {
    const suffix = selectedCountry === 'Japão' ? 'japan' : 'brazil';
    const dict = translations[language] || translations['pt'];
    const suffixedKey = `${key}.${suffix}`;
    
    // Look up suffixed key first, then fall back to normal key, then same for 'pt' default
    return dict[suffixedKey] || dict[key] || translations['pt'][suffixedKey] || translations['pt'][key] || key;
  }, [language, selectedCountry]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, selectedCountry, setSelectedCountry }}>
      {children}
    </LanguageContext.Provider>
  );
};

