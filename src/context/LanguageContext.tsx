import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { translations, Language } from '@/data/translations';
import { safeStorage } from '@/utils/storage';
import { loadFxRates, getRates } from '@/services/fxService';

export type CountryType = 'Brasil' | 'Japão' | 'Portugal' | 'França' | 'Itália' | 'Espanha';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  selectedCountry: CountryType;
  setSelectedCountry: (country: CountryType) => void;
  fxRates: { BRL: number; EUR: number };
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};

// Países cujo IP mapeia para português
const PT_COUNTRIES = new Set(['BR', 'PT', 'AO', 'MZ', 'CV', 'ST', 'GW', 'GQ', 'TL']);
// Países cujo IP mapeia para japonês
const JA_COUNTRIES = new Set(['JP']);

// ISO code → CountryType da loja
const COUNTRY_MAP: Record<string, CountryType> = {
  BR: 'Brasil', JP: 'Japão', PT: 'Portugal',
  FR: 'França', IT: 'Itália', ES: 'Espanha',
};

function ipToLanguage(code: string): Language {
  if (PT_COUNTRIES.has(code)) return 'pt';
  if (JA_COUNTRIES.has(code)) return 'ja';
  return 'en';
}

interface LanguageProviderProps { children: ReactNode; }

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = safeStorage.getItem('preferred-language');
    return (stored as Language) || 'pt';
  });

  const [selectedCountry, setSelectedCountryState] = useState<CountryType>(() => {
    const stored = safeStorage.getItem('sakura_selected_country');
    return (stored as CountryType) || 'Brasil';
  });

  // Cotação cambial do dia (¥→R$/€)
  const [fxRates, setFxRates] = useState(getRates());
  useEffect(() => { loadFxRates().then(setFxRates); }, []);

  // Auto-detect idioma/país por IP — só na primeira visita (sem preferência salva)
  useEffect(() => {
    const hasLang    = safeStorage.getItem('preferred-language');
    const hasCountry = safeStorage.getItem('sakura_selected_country');
    if (hasLang && hasCountry) return; // já tem preferências salvas

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    // ipapi.co suporta HTTPS gratuitamente (ip-api.com bloqueia mixed-content em HTTPS)
    fetch('https://ipapi.co/json/', { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then((data: { country_code?: string } | null) => {
        if (!data?.country_code) return;
        const code = data.country_code.toUpperCase();

        if (!hasLang) {
          const lang = ipToLanguage(code);
          setLanguageState(lang);
          safeStorage.setItem('preferred-language', lang);
        }
        if (!hasCountry) {
          const country = COUNTRY_MAP[code];
          if (country) {
            setSelectedCountryState(country);
            safeStorage.setItem('sakura_selected_country', country);
          }
        }
      })
      .catch(() => { /* falha silenciosa — mantém defaults */ })
      .finally(() => clearTimeout(timer));

    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    safeStorage.setItem('preferred-language', lang);
  }, []);

  const setSelectedCountry = useCallback((country: CountryType) => {
    setSelectedCountryState(country);
    safeStorage.setItem('sakura_selected_country', country);
  }, []);

  const t = useCallback((key: string): string => {
    const suffix = selectedCountry === 'Japão' ? 'japan' : 'brazil';
    const dict = translations[language] || translations['pt'];
    const suffixedKey = `${key}.${suffix}`;
    return dict[suffixedKey] || dict[key] || translations['pt'][suffixedKey] || translations['pt'][key] || key;
  }, [language, selectedCountry]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, selectedCountry, setSelectedCountry, fxRates }}>
      {children}
    </LanguageContext.Provider>
  );
};
