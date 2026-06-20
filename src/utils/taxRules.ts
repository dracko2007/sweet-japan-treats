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
