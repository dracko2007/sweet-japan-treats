import { yenFromConverted } from '@/services/fxService';
import { roundYen } from '@/utils/pricing';
import { getCountryConfig } from '@/data/worldCountries';


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
  const normalized = String(currency || 'JPY').toUpperCase();
  if (normalized === 'JPY' || !['BRL', 'EUR', 'USD'].includes(normalized)) {
    return Math.round(amount);
  }
  return roundYen(yenFromConverted(amount, normalized));
};

/**
 * Preço em duas partes: o valor na moeda do cliente e a referência em ¥
 * (null quando a moeda já é ¥ ou com `noConvert`). Telas estreitas mostram
 * uma em cima da outra (`PriceStack`); `formatPrice` junta as duas numa linha.
 */
export const formatPriceParts = (
  price: number,
  currency: 'BRL' | 'JPY' | 'EUR' | 'USD' | string,
  noConvert = false,
): { main: string; yen: string | null } => {
  if (currency === 'JPY') {
    return { main: `¥ ${Math.round(price).toLocaleString()}`, yen: null };
  }
  let main: string;
  let yenRef: number;
  if (currency === 'EUR') {
    main = `€ ${Math.round(price).toLocaleString('pt-BR')}`;
    yenRef = yenRefFromEur(price);
  } else if (currency === 'USD') {
    // USD mostra centavos (padrão americano)
    main = `$ ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    yenRef = yenRefFromUsd(price);
  } else {
    // BRL — arredonda para inteiro (sem centavos quebrados)
    main = `R$ ${Math.round(price).toLocaleString('pt-BR')}`;
    yenRef = yenRefFromBrl(price);
  }
  return { main, yen: noConvert ? null : `¥ ${roundYen(yenRef).toLocaleString()}` };
};

/**
 * Formats a numeric price into a localized string based on the currency (JPY, BRL, or EUR).
 */
export const formatPrice = (price: number, currency: 'BRL' | 'JPY' | 'EUR' | 'USD' | string, noConvert = false): string => {
  const { main, yen } = formatPriceParts(price, currency, noConvert);
  return yen ? `${main} (${yen})` : main;
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
  return 'USD';
};

