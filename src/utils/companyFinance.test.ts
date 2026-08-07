import { describe, expect, it } from 'vitest';
import {
  calcBrImportLandedCost,
  calcIofRemittance,
  calcJpIndividualTax,
  IOF_RATES,
} from './companyFinance';

describe('calcBrImportLandedCost', () => {
  it('exempts II when the customs value stays at or under US$50', () => {
    const result = calcBrImportLandedCost({
      productCostYen: 5_000,
      shippingCostYen: 0,
      usdPerYen: 1 / 150, // ¥5.000 ≈ US$33,3
      brlPerYen: 28 / 150,
      icmsRate: 0.2,
    });
    expect(result.isentoII).toBe(true);
    expect(result.iiBRL).toBe(0);
    expect(result.icmsBRL).toBeGreaterThan(0);
  });

  it('charges 60% II plus gross-up ICMS above US$50, per the Remessa Conforme formula', () => {
    const usdPerYen = 1 / 150;
    const brlPerYen = 1; // simplifies BRL == yen amount for the assertion
    const result = calcBrImportLandedCost({
      productCostYen: 10_000, // ≈ US$66,7 — over the threshold
      shippingCostYen: 2_000,
      usdPerYen,
      brlPerYen,
      icmsRate: 0.2,
    });
    const valorAduaneiro = 12_000;
    expect(result.isentoII).toBe(false);
    expect(result.iiBRL).toBeCloseTo(valorAduaneiro * 0.6, 5);
    // ICMS "por dentro": base = (valor + II) / (1 - taxa), não (valor + II) * taxa.
    const base = (valorAduaneiro + result.iiBRL) / (1 - 0.2);
    expect(result.icmsBRL).toBeCloseTo(base * 0.2, 5);
    expect(result.custoTotalBRL).toBeCloseTo(valorAduaneiro + result.iiBRL + result.icmsBRL, 5);
  });
});

describe('calcIofRemittance', () => {
  it('applies the rate for the declared purpose and lets it be overridden', () => {
    const importPayment = calcIofRemittance(1_000, 'pagamento_importacao');
    expect(importPayment.iofBRL).toBe(0);
    expect(importPayment.liquidoBRL).toBe(1_000);

    const capital = calcIofRemittance(1_000, 'capital_investimento');
    expect(capital.iofBRL).toBeCloseTo(1_000 * IOF_RATES.capital_investimento, 5);

    const overridden = calcIofRemittance(1_000, 'outro', 0.1);
    expect(overridden.iofBRL).toBe(100);
  });
});

describe('calcJpIndividualTax', () => {
  it('still owes the fixed 均等割 per-capita tax even when other taxes stay at zero', () => {
    const result = calcJpIndividualTax({ netProfitYen: 500_000, blueReturnDeduction: 650_000 });
    expect(result.incomeTax).toBe(0);
    expect(result.reconstructionSurtax).toBe(0);
    expect(result.businessTax).toBe(0);
    expect(result.residentTaxPerCapita).toBe(5_000);
    expect(result.netProfitAfterTax).toBe(500_000 - 5_000);
  });

  it('taxes the first income-tax bracket at 5% with no bracket deduction', () => {
    // 3.000.000 lucro − 650.000 (azul) − 480.000 (básica) = 1.870.000, dentro
    // da 1ª faixa (≤1.949.000, 5%, sem abatimento).
    const result = calcJpIndividualTax({ netProfitYen: 3_000_000 });
    expect(result.taxableForIncomeTax).toBe(1_870_000);
    expect(result.incomeTax).toBe(Math.round(1_870_000 * 0.05));
    expect(result.reconstructionSurtax).toBe(Math.round(result.incomeTax * 0.021));
    // Acima do 事業主控除 (¥2.900.000) por ¥100.000: 5% sobre o excedente.
    expect(result.businessTax).toBe(Math.round(100_000 * 0.05));
  });

  it('charges 個人事業税 only on profit above the ¥2.9M exemption, before the blue deduction', () => {
    const result = calcJpIndividualTax({ netProfitYen: 4_000_000 });
    expect(result.businessTax).toBe(Math.round((4_000_000 - 2_900_000) * 0.05));
  });
});
