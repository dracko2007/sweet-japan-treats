import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { translations, Language } from '@/data/translations';
import { safeStorage } from '@/utils/storage';
import { loadFxRates, getRates } from '@/services/fxService';
import { WORLD_COUNTRIES } from '@/data/worldCountries';

// Nome do país (ver lista completa em src/data/worldCountries.ts).
// String aberta porque agora há 40+ países — a config vem da tabela central.
export type CountryType = string;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  selectedCountry: CountryType;
  setSelectedCountry: (country: CountryType) => void;
  fxRates: { BRL: number; EUR: number; USD: number };
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};

// ISO code (upper) → config do país. Construído a partir da tabela central.
const ISO_TO_CONFIG: Record<string, import('@/data/worldCountries').CountryConfig> =
  Object.fromEntries(WORLD_COUNTRIES.map(c => [c.iso.toUpperCase(), c]));

function ipToLanguage(code: string): Language {
  return ISO_TO_CONFIG[code]?.language ?? 'en';
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

  // Cotação cambial do dia (¥→R$/€/$)
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
          const country = ISO_TO_CONFIG[code]?.name;
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
