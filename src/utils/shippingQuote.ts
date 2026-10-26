import type { CartItem } from '@/types';
import { japanPrefectures, japanShippingRates } from '@/data/japanPrefectures';
import { convertYen as fxConvert } from '@/services/fxService';
import { getCurrencyByCountry } from '@/utils/currency';
import { calculateCartShippingBoxes, type CartShippingBoxes } from '@/utils/shippingDimensions';
import { getELightRate, getAirParcelRate, getEmsRate, countryToZone, MAX_WEIGHT_G, type JapanPostZone } from '@/utils/japanPostRates';
import { effectiveYen } from '@/utils/pricing';

/**
 * Cotação de frete — FONTE ÚNICA usada pela calculadora do checkout e pelo
 * assistente virtual. Antes cada um tinha sua cópia das regras e elas podiam
 * divergir (o assistente chegou a cotar até 5,6x o valor real).
 */

export interface ShippingQuoteOption {
  carrier: string;
  name: string;
  logo: string;
  /** Valor na moeda do destino (¥ no Japão). */
  cost: number;
  /** Valor em ¥ (internacional); null no Japão (cost já é ¥) ou "consultar". */
  costYen: number | null;
  /** Valor cheio quando o frete ficou grátis (Japão acima do mínimo). */
  originalCost?: number;
  estimatedDays: string;
  /** Sem preço fixo: frete marítimo / "a combinar". */
  isConsultar?: boolean;
  isCombinar?: boolean;
}

export interface ShippingQuote {
  options: ShippingQuoteOption[];
  boxes: CartShippingBoxes;
  currency: 'BRL' | 'JPY' | 'EUR' | 'USD';
  isJapan: boolean;
  isFreeShipping: boolean;
  isOverweight: boolean;
  /** Japão sem província escolhida: o preço depende da zona de entrega. */
  needsPrefecture: boolean;
}

/** Mínimo (¥) para frete grátis dentro do Japão. */
export const JAPAN_FREE_SHIPPING_MIN_YEN = 6000;

/** Mesmo cálculo de `getSpaceUsed` do carrinho. */
export const spaceUsedOf = (items: CartItem[]) => {
  let small = 0;
  let large = 0;
  for (const item of items) {
    if (item.size === 'small') small += item.quantity;
    else large += item.quantity;
  }
  return { small, large, totalSmallEquivalent: small + large * 2 };
};

// Prazo estimado por zona Japan Post (e-Light / Air / EMS)
const DAYS_BY_ZONE: Record<number, { light: string; air: string; ems: string }> = {
  1: { light: '6-10', air: '4-7', ems: '2-4' }, // China/Coreia/Taiwan
  2: { light: '7-12', air: '5-9', ems: '3-5' }, // Ásia
  3: { light: '7-14', air: '6-10', ems: '4-7' }, // Europa/Oceania
  4: { light: '7-14', air: '6-10', ems: '3-6' }, // EUA
  5: { light: '20-40', air: '10-15', ems: '18' }, // Brasil/Am.Sul/África
};

const JAPAN_CARRIERS = {
  yuubin: { name: 'Japan Post Local (ゆうパック) ✉️', logo: '📮' },
  yamato: { name: 'Yamato Transport (宅急便) 🐱', logo: '📦' },
  sagawa: { name: 'Sagawa Express (飛脚宅配便) 🏃‍♂️', logo: '⚡' },
} as const;
const JAPAN_DAYS: Record<number, string> = { 1: '1-2', 2: '1-2', 3: '2-3', 4: '3-4' };

interface QuoteOptions {
  /** Nome da província (só Japão). */
  prefecture?: string;
  /** Desconto de cupom já na moeda do destino (afeta o frete grátis no Japão). */
  couponDiscount?: number;
}

export function quoteShipping(items: CartItem[], destinationCountry: string, { prefecture, couponDiscount = 0 }: QuoteOptions = {}): ShippingQuote {
  const country = destinationCountry || 'Brasil';
  const isJapan = country === 'Japão';
  const currency = getCurrencyByCountry(country);
  const jpZone: JapanPostZone = countryToZone(country);
  const boxes = calculateCartShippingBoxes(items, spaceUsedOf(items));
  const hasCustomRequest = items.some((item) => item.product?.id?.includes('custom') || item.product?.category === 'custom-request');

  const displaySubtotal = items.reduce((sum, item) => sum + fxConvert(effectiveYen(item.product, item.size), currency) * item.quantity, 0);
  const isFreeShipping = isJapan && items.length > 0 && displaySubtotal - couponDiscount >= JAPAN_FREE_SHIPPING_MIN_YEN;
  const isOverweight = !isJapan && boxes.totalWeightG > MAX_WEIGHT_G;

  const base = { boxes, currency, isJapan, isFreeShipping, isOverweight };

  if (items.length === 0) return { ...base, options: [], needsPrefecture: false };

  if (isJapan) {
    const pref = japanPrefectures.find((p) => p.name === prefecture);
    if (!pref) return { ...base, options: [], needsPrefecture: true };
    const zone = pref.zone as 1 | 2 | 3 | 4;
    const options = (Object.keys(JAPAN_CARRIERS) as Array<keyof typeof JAPAN_CARRIERS>).map((carrier) => {
      let totalCost = 0;
      if (boxes.boxes60 > 0) totalCost += japanShippingRates[carrier]['60'][zone] * boxes.boxes60;
      if (boxes.boxes80 > 0) totalCost += japanShippingRates[carrier]['80'][zone] * boxes.boxes80;
      if (totalCost === 0) totalCost = japanShippingRates[carrier]['60'][zone];
      return {
        carrier,
        ...JAPAN_CARRIERS[carrier],
        cost: isFreeShipping ? 0 : totalCost,
        costYen: null,
        originalCost: isFreeShipping ? totalCost : undefined,
        estimatedDays: JAPAN_DAYS[zone] || '2-3',
      } satisfies ShippingQuoteOption;
    }).sort((a, b) => a.cost - b.cost);
    return { ...base, options, needsPrefecture: false };
  }

  // Internacional — Japan Post por peso
  const weightG = boxes.totalWeightG;
  if (weightG <= 0 || isOverweight) return { ...base, options: [], needsPrefecture: false };
  const zd = DAYS_BY_ZONE[jpZone] || DAYS_BY_ZONE[5];
  const options: ShippingQuoteOption[] = [];

  if (weightG <= 2000) {
    const eLightYen = getELightRate(weightG, jpZone);
    if (eLightYen) options.push({
      carrier: 'eraito', name: 'Japan Post E-Light · 国際eパケットライト', logo: '📦',
      cost: fxConvert(eLightYen, currency), costYen: eLightYen, estimatedDays: zd.light,
    });
  } else {
    const airYen = getAirParcelRate(weightG, jpZone);
    if (airYen) options.push({
      carrier: 'kozutsumi-air', name: 'Japan Post Kozutsumi Air · 国際小包 航空便', logo: '📦',
      cost: fxConvert(airYen, currency), costYen: airYen, estimatedDays: zd.air,
    });
  }

  // EMS para todas as faixas de peso
  const emsYen = getEmsRate(weightG, jpZone);
  if (emsYen) options.push({
    carrier: 'ems', name: 'Japan Post EMS · 国際スピード郵便 (via DHL)', logo: '✈️',
    cost: fxConvert(emsYen, currency), costYen: emsYen, estimatedDays: zd.ems,
  });

  // Marítimo — sempre "consultar"
  options.push({
    carrier: 'maritimo', name: 'Sea Freight · 船便', logo: '🚢',
    cost: 0, costYen: null, estimatedDays: '60-90', isConsultar: true,
  });

  // A combinar — frete após pesagem real (só encomendas personalizadas)
  if (hasCustomRequest) options.push({
    carrier: 'a-combinar', name: 'A Combinar · 要相談 (Apenas para encomendas fora do site)', logo: '⚖️',
    cost: 0, costYen: null, estimatedDays: 'A definir', isConsultar: true, isCombinar: true,
  });

  options.sort((a, b) => {
    if (a.isCombinar) return 1;
    if (b.isCombinar) return -1;
    if (a.isConsultar) return 1;
    if (b.isConsultar) return -1;
    return a.cost - b.cost;
  });
  return { ...base, options, needsPrefecture: false };
}
