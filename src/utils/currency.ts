import { getRates } from '@/services/fxService';

export const BRL_TO_JPY_RATE = 28;
export const BRL_TO_EUR_RATE = 0.16;

// ¥ de referência a partir de um valor em R$/€, usando a MESMA cotação ao vivo
// que gerou o preço (fxService). Assim o "(¥…)" exibido bate com o preço real do
// catálogo e com os pontos. Se a taxa não carregou, cai no fixo antigo.
const yenRefFromBrl = (brl: number): number => {
  const r = getRates().BRL;
  return Math.round(r > 0 ? brl / r : brl * BRL_TO_JPY_RATE);
};
const yenRefFromEur = (eur: number): number => {
  const r = getRates().EUR;
  return Math.round(r > 0 ? eur / r : (eur / BRL_TO_EUR_RATE) * BRL_TO_JPY_RATE);
};

/**
 * Converte qualquer valor para IENE (¥), de acordo com a moeda de origem.
 * Usado no dashboard para somar vendas de moedas diferentes de forma consistente.
 * Moeda ausente/desconhecida → assume que já está em ¥ (não infla o valor).
 */
export const toYen = (amount: number, currency?: string): number => {
  if (!amount) return 0;
  if (currency === 'BRL') return Math.round(amount * BRL_TO_JPY_RATE);
  if (currency === 'EUR') return Math.round((amount / BRL_TO_EUR_RATE) * BRL_TO_JPY_RATE);
  return Math.round(amount); // JPY ou desconhecido
};

/**
 * Formats a numeric price into a localized string based on the currency (JPY, BRL, or EUR).
 */
export const formatPrice = (price: number, currency: 'BRL' | 'JPY' | 'EUR' | string, noConvert = false): string => {
  if (currency === 'JPY') {
    return `¥ ${Math.round(price).toLocaleString()}`;
  }
  if (currency === 'EUR') {
    const rounded = Math.round(price);
    const mainStr = `€ ${rounded.toLocaleString('pt-BR')}`;
    if (noConvert) return mainStr;
    return `${mainStr} (¥ ${yenRefFromEur(price).toLocaleString()})`;
  }
  // BRL — arredonda para inteiro (sem centavos quebrados)
  const rounded = Math.round(price);
  const mainStr = `R$ ${rounded.toLocaleString('pt-BR')}`;
  if (noConvert) return mainStr;
  return `${mainStr} (¥ ${yenRefFromBrl(price).toLocaleString()})`;
};

/**
 * Gets the currency code based on country name.
 */
export const getCurrencyByCountry = (country: string): 'BRL' | 'JPY' | 'EUR' => {
  if (country === 'Japão') return 'JPY';
  if (['Portugal', 'França', 'Itália', 'Espanha'].includes(country)) return 'EUR';
  return 'BRL';
};

/**
 * Converts BRL value to country specific value
 */
export const convertBrlToCountry = (priceInBrl: number, country: string): number => {
  if (country === 'Japão') {
    return priceInBrl * BRL_TO_JPY_RATE;
  }
  if (['Portugal', 'França', 'Itália', 'Espanha'].includes(country)) {
    return priceInBrl * BRL_TO_EUR_RATE;
  }
  return priceInBrl;
};

/**
 * Converts a price from BRL to JPY using a fixed conversion rate.
 */
export const convertBrlToJpy = (priceInBrl: number): number => {
  return priceInBrl * BRL_TO_JPY_RATE;
};

/**
 * Converts a price from JPY to BRL using a fixed conversion rate.
 */
export const convertJpyToBrl = (priceInJpy: number): number => {
  return priceInJpy / BRL_TO_JPY_RATE;
};
