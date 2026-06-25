import { getCountryConfig } from '@/data/worldCountries';

// Brazilian import tax rules (Remessa Conforme program)
// Source: Receita Federal / Portaria MF nº 612/2023
export const BRAZIL_TAX = {
  thresholdBRL: 250,   // ~USD 50 — below this, flat 20% II applies
  belowRate: 0.20,
  aboveRate: 0.60,
  aboveOffset: 62.50,  // simplified formula: (price × 0.60) − 62.50
  icmsRate: 0.17,      // average ICMS (varies by state, 17% is a safe estimate)
} as const;

export const EU_VAT_RATES: Record<string, number> = {
  Portugal: 0.23,
  França:   0.20,
  Itália:   0.22,
  Espanha:  0.21,
};

export function calcBrazilTax(price: number): { federal: number; icms: number; total: number } {
  const federal =
    price < BRAZIL_TAX.thresholdBRL
      ? price * BRAZIL_TAX.belowRate
      : price * BRAZIL_TAX.aboveRate - BRAZIL_TAX.aboveOffset;
  const icms = (price + federal) * BRAZIL_TAX.icmsRate;
  return { federal, icms, total: federal + icms };
}

export function calcEuVat(price: number, country: string): number {
  return price * (EU_VAT_RATES[country] ?? 0.20);
}

// IVA/VAT/GST universal — consulta a taxa do país na tabela central.
// Para EUA usa sales tax por estado (calcUsSalesTax); demais usam a taxa do país.
export function calcImportTax(price: number, country: string, stateCode?: string): { tax: number; label: string } {
  if (country === 'Brasil') {
    const br = calcBrazilTax(price);
    return { tax: br.total, label: 'Impostos Estimados (Brasil)' };
  }
  if (country === 'Estados Unidos') {
    const tax = calcUsSalesTax(price, stateCode);
    const stRate = US_SALES_TAX[(stateCode || '').toUpperCase()];
    return { tax, label: stRate != null ? `Sales Tax Est. (${stateCode} ${(stRate * 100).toFixed(1)}%)` : 'Sales Tax Estimado (US)' };
  }
  const cfg = getCountryConfig(country);
  const rate = cfg ? cfg.vat : 0.10;
  if (rate <= 0) return { tax: 0, label: '' };
  return { tax: price * rate, label: `IVA / VAT Estimado (${Math.round(rate * 100)}%)` };
}

// ── USA Sales Tax por estado ─────────────────────────────────────────────────
// Taxa combinada média (estadual + média local), arredondada. Fonte: Tax Foundation.
// 5 estados sem sales tax: AK, DE, MT, NH, OR.
export const US_SALES_TAX: Record<string, number> = {
  AL: 0.0924, AK: 0.0176, AZ: 0.0838, AR: 0.0947, CA: 0.0882,
  CO: 0.0777, CT: 0.0635, DE: 0.0,    FL: 0.0702, GA: 0.0735,
  HI: 0.0444, ID: 0.0603, IL: 0.0888, IN: 0.0700, IA: 0.0694,
  KS: 0.0869, KY: 0.0600, LA: 0.0955, ME: 0.0550, MD: 0.0600,
  MA: 0.0625, MI: 0.0600, MN: 0.0749, MS: 0.0707, MO: 0.0825,
  MT: 0.0,    NE: 0.0694, NV: 0.0823, NH: 0.0,    NJ: 0.0660,
  NM: 0.0762, NY: 0.0852, NC: 0.0698, ND: 0.0697, OH: 0.0723,
  OK: 0.0899, OR: 0.0,    PA: 0.0634, RI: 0.0700, SC: 0.0744,
  SD: 0.0640, TN: 0.0955, TX: 0.0820, UT: 0.0719, VT: 0.0624,
  VA: 0.0573, WA: 0.0938, WV: 0.0656, WI: 0.0543, WY: 0.0536,
  DC: 0.0600,
};

const US_AVG_SALES_TAX = 0.0699; // média nacional quando o estado é desconhecido

/** Sales tax dos EUA: usa a sigla do estado (ex: 'CA', 'NY'); fallback = média nacional. */
export function calcUsSalesTax(price: number, stateCode?: string): number {
  const code = (stateCode || '').trim().toUpperCase();
  const rate = code in US_SALES_TAX ? US_SALES_TAX[code] : US_AVG_SALES_TAX;
  return price * rate;
}
