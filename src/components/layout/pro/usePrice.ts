import { useCallback } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { convertYen } from '@/services/fxService';

/** ¥ → texto na moeda do país selecionado (mesma cadeia usada no carrinho). */
export const usePrice = () => {
  const { selectedCountry } = useLanguage();
  const currency = getCurrencyByCountry(selectedCountry);
  return useCallback((yen: number) => formatPrice(convertYen(yen, currency), currency), [currency]);
};
