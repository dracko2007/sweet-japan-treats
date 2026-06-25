import { yenFromConverted } from '@/services/fxService';
import { roundYen } from '@/utils/pricing';
import { getCountryConfig } from '@/data/worldCountries';

export const BRL_TO_JPY_RATE = 28;
export const BRL_TO_EUR_RATE = 0.16;

// Desfaz o RATE_CUSHION aplicado em convertYen para mostrar o ¥ real do produto.
const yenRefFromBrl = (brl: number): number => yenFromConverted(brl, 'BRL');
const yenRefFromEur = (eur: number): number => yenFromConverted(eur, 'EUR');
const yenRefFromUsd = (usd: number): number => yenFromConverted(usd, 'USD');

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
export const formatPrice = (price: number, currency: 'BRL' | 'JPY' | 'EUR' | 'USD' | string, noConvert = false): string => {
  if (currency === 'JPY') {
    return `¥ ${Math.round(price).toLocaleString()}`;
  }
  if (currency === 'EUR') {
    const rounded = Math.round(price);
    const mainStr = `€ ${rounded.toLocaleString('pt-BR')}`;
    if (noConvert) return mainStr;
    return `${mainStr} (¥ ${roundYen(yenRefFromEur(price)).toLocaleString()})`;
  }
  if (currency === 'USD') {
    // USD mostra centavos (padrão americano)
    const mainStr = `$ ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (noConvert) return mainStr;
    return `${mainStr} (¥ ${roundYen(yenRefFromUsd(price)).toLocaleString()})`;
  }
  // BRL — arredonda para inteiro (sem centavos quebrados)
  const rounded = Math.round(price);
  const mainStr = `R$ ${rounded.toLocaleString('pt-BR')}`;
  if (noConvert) return mainStr;
  return `${mainStr} (¥ ${roundYen(yenRefFromBrl(price)).toLocaleString()})`;
};

/**
 * Gets the currency code based on country name.
 */
export const getCurrencyByCountry = (country: string): 'BRL' | 'JPY' | 'EUR' | 'USD' => {
  const cfg = getCountryConfig(country);
  if (cfg) return cfg.currency;
  // Retrocompat para nomes antigos
  if (country === 'Japão') return 'JPY';
  if (country === 'Estados Unidos') return 'USD';
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
