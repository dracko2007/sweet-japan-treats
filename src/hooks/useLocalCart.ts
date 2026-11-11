import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import type { CartItem } from '@/types';
import { localOffer, shipAllFromJapan, splitCart } from '@/utils/localStock';

const keyOf = (item: CartItem) => `${item.product.id}|${item.size}`;

/**
 * Como o carrinho atual se divide entre itens que já estão no país do cliente
 * e itens que vêm do Japão, e qual preço cada linha mostra.
 */
export function useLocalCart() {
  const { items } = useCart();
  const { selectedCountry } = useLanguage();
  const [forcedJapan, setForcedJapan] = useState(shipAllFromJapan);
  useEffect(() => {
    const sync = () => setForcedJapan(shipAllFromJapan());
    window.addEventListener('fulfillment-changed', sync);
    return () => window.removeEventListener('fulfillment-changed', sync);
  }, []);

  return useMemo(() => {
    const split = splitCart(items, selectedCountry);
    const localKeys = new Set(forcedJapan ? [] : split.localItems.map(keyOf));
    /** Preço fixo local da linha, ou null quando vale a conta do Japão. */
    const localPrice = (item: CartItem): number | null =>
      (localKeys.has(keyOf(item)) ? localOffer(item.product, selectedCountry)?.price ?? null : null);
    return {
      split,
      forcedJapan,
      localPrice,
      /** Todo o carrinho sai do país do cliente (e ele não pediu envio único do Japão). */
      localOrder: split.kind === 'local' && !forcedJapan,
      country: selectedCountry,
    };
  }, [items, selectedCountry, forcedJapan]);
}
