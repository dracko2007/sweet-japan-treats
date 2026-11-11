import { useCallback } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { convertYen } from '@/services/fxService';
import { minEffectiveYen } from '@/utils/pricing';
import { localOffer } from '@/utils/localStock';
import type { Product } from '@/types';

/** ¥ → texto na moeda do país selecionado (mesma cadeia usada no carrinho). */
export const usePrice = () => {
  const { selectedCountry } = useLanguage();
  const currency = getCurrencyByCountry(selectedCountry);
  return useCallback((yen: number) => formatPrice(convertYen(yen, currency), currency), [currency]);
};

/**
 * Preço "a partir de" de um produto na vitrine. Produto que já está no país do
 * cliente mostra o preço fixo local, sem a referência em ¥.
 */
export const useProductPrice = () => {
  const { selectedCountry } = useLanguage();
  const currency = getCurrencyByCountry(selectedCountry);
  return useCallback((product: Product) => {
    const offer = localOffer(product, selectedCountry);
    return offer
      ? formatPrice(offer.price, currency, true)
      : formatPrice(convertYen(minEffectiveYen(product), currency), currency);
  }, [currency, selectedCountry]);
};
