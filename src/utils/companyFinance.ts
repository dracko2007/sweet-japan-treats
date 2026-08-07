// Calculadora financeira INTERNA da empresa (aba Financeiro > Importação/Câmbio/Imposto).
//
// Isto é DIFERENTE da estimativa de imposto mostrada ao cliente no carrinho
// (`src/utils/taxRules.ts` — `calcBrazilTax`/`calcImportTax` devolvem 0 de
// propósito para o Brasil, porque o regime de UM pacote de consumidor varia
// caso a caso e a loja decidiu não arriscar Deturpação no Google Merchant
// com um número que pode não bater — ver `shared/tax-disclosure.js`).
//
// Aqui o uso é o oposto: é o ADMIN decidindo quanto vai custar importar como
// a própria filial, quanto o banco desconta de IOF na remessa e quanto sobra
// de lucro depois do imposto pessoal no Japão (individual/個人事業主, sem
// CNPJ de pessoa jurídica). Precisa do número real, calculado com a fórmula
// oficial — não de um aviso genérico.
//
// Todo valor abaixo é uma ESTIMATIVA com alíquota vigente em 2026 (fonte em
// cada bloco). Câmbio, decretos de IOF e reforma tributária mudam a cada
// poucos meses — confirme com contador/despachante antes de decidir.

// ── Brasil: Remessa Conforme (importação da filial) ──────────────────────
// Fonte: Receita Federal, Programa Remessa Conforme (Portaria MF 612/2023) +
// Convênio ICMS 81/2023. Isenção de II só vale para plataforma certificada;
// acima de US$50 perde a isenção inteira (não é só sobre o excedente).
export const BR_REMESSA_CONFORME = {
  thresholdUSD: 50,
  iiRate: 0.6,
  icmsRateDefault: 0.2,
} as const;

export interface BrImportInput {
  /** Custo do produto pago ao fornecedor, em ¥. */
  productCostYen: number;
  /** Frete pago para enviar do Japão, em ¥. */
  shippingCostYen: number;
  /** Câmbio ¥→US$ (para checar o teto de US$50). */
  usdPerYen: number;
  /** Câmbio ¥→R$ (para calcular II/ICMS em reais). */
  brlPerYen: number;
  /** Alíquota de ICMS do estado de destino (default: média nacional 20%). */
  icmsRate?: number;
}

export interface BrImportResult {
  valorAduaneiroBRL: number;
  valorAduaneiroUSD: number;
  isentoII: boolean;
  iiBRL: number;
  icmsBRL: number;
  totalImpostosBRL: number;
  /** Valor aduaneiro + impostos — o que a mercadoria custou pronta no Brasil. */
  custoTotalBRL: number;
  custoTotalYen: number;
}

export function calcBrImportLandedCost(input: BrImportInput): BrImportResult {
  const {
    productCostYen,
    shippingCostYen,
    usdPerYen,
    brlPerYen,
    icmsRate = BR_REMESSA_CONFORME.icmsRateDefault,
  } = input;
  const valorAduaneiroYen = Math.max(0, productCostYen) + Math.max(0, shippingCostYen);
  const valorAduaneiroBRL = valorAduaneiroYen * brlPerYen;
  const valorAduaneiroUSD = valorAduaneiroYen * usdPerYen;
  const isentoII = valorAduaneiroUSD <= BR_REMESSA_CONFORME.thresholdUSD;
  const iiBRL = isentoII ? 0 : valorAduaneiroBRL * BR_REMESSA_CONFORME.iiRate;
  // ICMS "por dentro" (Lei Kandir, art. 13 §1º I 'b'): a alíquota incide sobre
  // uma base que já inclui o próprio ICMS. Base = (valor + II) / (1 − alíquota),
  // não (valor + II) × alíquota — senão o imposto recolhido fica menor que o devido.
  const icmsBase = valorAduaneiroBRL + iiBRL > 0 ? (valorAduaneiroBRL + iiBRL) / (1 - icmsRate) : 0;
  const icmsBRL = icmsBase * icmsRate;
  const totalImpostosBRL = iiBRL + icmsBRL;
  const custoTotalBRL = valorAduaneiroBRL + totalImpostosBRL;
  return {
    valorAduaneiroBRL,
    valorAduaneiroUSD,
    isentoII,
    iiBRL,
    icmsBRL,
    totalImpostosBRL,
    custoTotalBRL,
    custoTotalYen: brlPerYen > 0 ? custoTotalBRL / brlPerYen : 0,
  };
}

// ── IOF sobre remessa internacional (Brasil → Japão) ──────────────────────
// Fonte: Decretos 12.466/2025 e 12.499/2025. Pagamento de importação de bens/
// serviços ficou de fora da alta geral para 3,5% — continua na faixa isenta/
// de natureza específica. Capital/disponibilidade ao exterior foi para 3,5%.
// O banco decide pelo código de natureza cambial informado no fechamento —
// os três valores abaixo são o ponto de partida, não a palavra final.
export type IofPurpose = 'pagamento_importacao' | 'capital_investimento' | 'outro';

export const IOF_RATES: Record<IofPurpose, number> = {
  pagamento_importacao: 0,
  capital_investimento: 0.035,
  outro: 0.0038,
};

export const IOF_PURPOSE_LABELS: Record<IofPurpose, string> = {
  pagamento_importacao: 'Pagamento de importação (mercadoria/frete)',
  capital_investimento: 'Transferência de capital / disponibilidade',
  outro: 'Outra natureza cambial',
};

export interface IofResult {
  iofBRL: number;
  liquidoBRL: number;
}

export function calcIofRemittance(valorBRL: number, purpose: IofPurpose, rateOverride?: number): IofResult {
  const rate = rateOverride ?? IOF_RATES[purpose];
  const base = Math.max(0, valorBRL);
  const iofBRL = base * rate;
  return { iofBRL, liquidoBRL: base - iofBRL };
}

// ── Japão: 個人事業主 (pessoa física — sem CNPJ de pessoa jurídica) ────────
// Fontes: tabela de IR nacional 2025 (nta.go.jp — 所得税の速算表), 復興特別
//所得税 2,1% (até 2037), 個人事業税 5% para comércio/1種事業 com 事業主控除
// anual de ¥2.900.000, 住民税 10% padrão (6% município + 4% prefeitura) com
// 均等割 fixo e base própria de dedução (¥430.000, diferente da do IR),
// 青色申告特別控除 conforme o regime de escrituração.
export const JP_INCOME_TAX_BRACKETS = [
  { upTo: 1_949_000, rate: 0.05, deduction: 0 },
  { upTo: 3_299_000, rate: 0.1, deduction: 97_500 },
  { upTo: 6_949_000, rate: 0.2, deduction: 427_500 },
  { upTo: 8_999_000, rate: 0.23, deduction: 636_000 },
  { upTo: 17_999_000, rate: 0.33, deduction: 1_536_000 },
  { upTo: 39_999_000, rate: 0.4, deduction: 2_796_000 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 4_796_000 },
] as const;

export const JP_RECONSTRUCTION_SURTAX_RATE = 0.021;
export const JP_RESIDENT_TAX_RATE = 0.1;
export const JP_RESIDENT_TAX_PER_CAPITA = 5_000;
export const JP_RESIDENT_TAX_BASIC_DEDUCTION = 430_000;
export const JP_BUSINESS_TAX_RATE = 0.05;
export const JP_BUSINESS_TAX_EXEMPTION = 2_900_000;

export const BLUE_RETURN_DEDUCTIONS = [0, 100_000, 550_000, 650_000] as const;
export type BlueReturnDeduction = (typeof BLUE_RETURN_DEDUCTIONS)[number];

export interface JpIndividualTaxInput {
  /** Lucro do negócio (receita − despesas dedutíveis), ANTES do controle azul. */
  netProfitYen: number;
  /** 青色申告特別控除 — depende do regime de escrituração/entrega. */
  blueReturnDeduction?: BlueReturnDeduction;
  /** 基礎控除 do IR — 48万 padrão histórico, até 95万 pela reforma 2025 conforme a faixa de renda. */
  basicDeduction?: number;
  /** Outras deduções pessoais (INSS/国民年金, plano de saúde, etc.). */
  otherDeductions?: number;
}

export interface JpIndividualTaxResult {
  taxableForIncomeTax: number;
  incomeTax: number;
  reconstructionSurtax: number;
  residentTax: number;
  residentTaxPerCapita: number;
  businessTax: number;
  totalTax: number;
  netProfitAfterTax: number;
}

export function calcJpIndividualTax(input: JpIndividualTaxInput): JpIndividualTaxResult {
  const {
    netProfitYen,
    blueReturnDeduction = 650_000,
    basicDeduction = 480_000,
    otherDeductions = 0,
  } = input;
  const profit = Math.max(0, netProfitYen);
  const afterBlue = Math.max(0, profit - blueReturnDeduction);

  // 個人事業税: incide sobre o lucro ANTES do controle azul (a dedução azul é
  // só do IR/住民税) menos o 事業主控除 anual fixo.
  const businessTaxBase = Math.max(0, profit - JP_BUSINESS_TAX_EXEMPTION);
  const businessTax = Math.round(businessTaxBase * JP_BUSINESS_TAX_RATE);

  // IR nacional: lucro após controle azul, menos deduções pessoais.
  const taxableForIncomeTax = Math.max(0, afterBlue - basicDeduction - otherDeductions);
  const bracket = JP_INCOME_TAX_BRACKETS.find((b) => taxableForIncomeTax <= b.upTo) ?? JP_INCOME_TAX_BRACKETS.at(-1)!;
  const incomeTax = Math.max(0, Math.round(taxableForIncomeTax * bracket.rate - bracket.deduction));
  const reconstructionSurtax = Math.round(incomeTax * JP_RECONSTRUCTION_SURTAX_RATE);

  // 住民税: base de dedução própria, distinta da do IR nacional.
  const residentTaxBase = Math.max(0, afterBlue - JP_RESIDENT_TAX_BASIC_DEDUCTION - otherDeductions);
  const residentTax = Math.round(residentTaxBase * JP_RESIDENT_TAX_RATE);

  const totalTax = incomeTax + reconstructionSurtax + residentTax + JP_RESIDENT_TAX_PER_CAPITA + businessTax;
  return {
    taxableForIncomeTax,
    incomeTax,
    reconstructionSurtax,
    residentTax,
    residentTaxPerCapita: JP_RESIDENT_TAX_PER_CAPITA,
    businessTax,
    totalTax,
    netProfitAfterTax: profit - totalTax,
  };
}
