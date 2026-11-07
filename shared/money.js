// Conta de dinheiro do checkout em UM lugar — a mesma para a tela e para a
// cobrança.
//
// Até novembro/2026 a tela e o servidor faziam a conta cada um do seu jeito:
// a tela convertia cada unidade para R$/€/$ e arredondava para inteiro; o
// servidor convertia o total de uma vez, com centavos, e ainda aplicava 5% de
// desconto no cartão/PIX que a tela não mostrava (o desconto saiu do site em
// 07/06/2026, "remove desconto 5%", e voltou só no servidor em 24/07). O
// cliente via R$ 903 e o cartão era cobrado em R$ 886,71; na Wise, o
// contrário: tela € 97, cobrança € 98,03. As taxas do PIX (IOF + R$ 32)
// apareciam na tela e não entravam na cobrança.
//
// Regra daqui em diante: toda linha em moeda estrangeira é um valor inteiro
// (R$, €, $), calculado por estas funções, e o total cobrado é a soma
// exata das linhas que o cliente vê.
//
// Mora em `shared/` pelo mesmo motivo que `pricing.js`: `src` não pode
// importar de `api/_lib`.

import { roundYen } from './pricing.js';

/** Margem fixa somada ao ¥ de cada unidade (protege item barato do câmbio). */
export const FX_BUFFER_YEN = 5;
/** Câmbio fora da Wise (open.er-api, diário) ganha +4% pela defasagem. */
export const RATE_CUSHION_FALLBACK = 0.04;

/** Taxa do Personal Shopper por unidade comprada. */
export const PS_FEE_PER_UNIT_YEN = 1000;
/** Desconto na taxa PS que sai aprovado na hora, por unidade. */
export const PS_FEE_AUTO_DISCOUNT_PER_UNIT_YEN = 300;

/** PIX direto: IOF da remessa internacional + tarifa fixa do banco. */
export const PIX_IOF_RATE = 0.035;
export const PIX_BANK_FEE_BRL = 32;

// EUA: desde 15/10/2026 o Japan Post só aceita mercadoria para os EUA com o
// imposto pré-pago (DDP) por app credenciado (Zonos ou SafePackage), em
// qualquer valor até US$ 2.500. A loja paga antes de postar, então a conta
// precisa cobrar do cliente. Produto japonês com tarifa-base zero (cosmético,
// HTS 3304) paga 12,5% (tarifa-base + Seção 301, desde 24/07/2026), mais a
// taxa de processamento da CBP por remessa informal (US$ 2,77 desde
// 01/10/2026). A tarifa do app credenciado não entra: o valor não é público.
export const US_COUNTRY = 'Estados Unidos';
export const US_IMPORT_DUTY_RATE = 0.125;
export const US_ENTRY_FEE_USD = 2.77;

/** Cushion conforme a origem da cotação: a da Wise já bate com o app. */
export function rateCushion(rates) {
  return rates?.source === 'wise' ? 0 : RATE_CUSHION_FALLBACK;
}

function baseRate(currency, rates) {
  const rate = Number(rates?.[currency]);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/**
 * ¥ → moeda do cliente, em unidade inteira. É o número da vitrine.
 * `exact` tira a margem de ¥5 e o cushion (taxa PS: o cliente vê o ¥ exato).
 */
export function yenToDisplay(yen, currency, rates, { exact = false } = {}) {
  const value = Number(yen) || 0;
  if (currency === 'JPY') return Math.round(value);
  if (value <= 0) return 0;
  const rate = baseRate(currency, rates) * (exact ? 1 : 1 + rateCushion(rates));
  return Math.round((value + (exact ? 0 : FX_BUFFER_YEN)) * rate);
}

/**
 * Desconto em ¥ → moeda do cliente: mesma taxa dos produtos, sem a margem de
 * ¥5 (ela protege a venda de uma unidade, não um abatimento).
 */
export function discountYenToDisplay(yen, currency, rates) {
  const value = Number(yen) || 0;
  if (currency === 'JPY') return Math.round(value);
  if (value <= 0) return 0;
  return Math.round(value * baseRate(currency, rates) * (1 + rateCushion(rates)));
}

/**
 * Lê um cupom do jeito que o servidor sempre leu (`api/_lib/commerce.js`):
 * cupom fixo é em IENES; percentual vem em `discountPercent` (recuperação de
 * carrinho) ou em `discount` (cupom global/pessoal); frete grátis não dá
 * desconto em produto.
 */
export function couponTerms(coupon) {
  if (!coupon) return null;
  const freeShipping = coupon.freeShipping === true;
  const fixed = coupon.discountType === 'fixed' || coupon.type === 'fixed';
  const rawPercent = coupon.discountPercent != null ? coupon.discountPercent : coupon.discount;
  const percent = Math.max(0, Math.min(100, Number(rawPercent) || 0));
  return {
    freeShipping,
    fixed,
    percent: freeShipping || fixed ? 0 : percent,
    fixedYen: freeShipping || !fixed ? 0 : Math.max(0, Number(coupon.discount) || 0),
    affiliate: Boolean(coupon.affiliateCode),
    minOrderYen: Math.max(0, Number(coupon.minOrderValue) || 0),
  };
}

/** Linha entra na base do cupom? Promoção da home e brinde nunca; afiliado não empilha com desconto do produto. */
function couponEligible(line, terms) {
  if (line.freeGift || line.homePromo) return false;
  if (terms?.affiliate && line.productDiscounted) return false;
  return true;
}

/**
 * Benefícios em ¥ sobre a mercadoria. Mesma ordem do servidor: cupom, depois
 * pontos (que pagam só mercadoria), depois taxa PS.
 *
 * `lines`: [{ unitYen, quantity, freeGift, homePromo, productDiscounted, noPsFee }]
 */
export function productBenefits({ lines, coupon = null, redeemPoints = 0 }) {
  const terms = couponTerms(coupon);
  let productSubtotalYen = 0;
  let regularSubtotalYen = 0;
  let psFeeYen = 0;
  for (const line of lines) {
    const quantity = Number(line.quantity) || 0;
    const lineYen = line.freeGift ? 0 : (Number(line.unitYen) || 0) * quantity;
    productSubtotalYen += lineYen;
    if (couponEligible(line, terms)) regularSubtotalYen += lineYen;
    if (!line.freeGift && !line.noPsFee) psFeeYen += quantity * PS_FEE_PER_UNIT_YEN;
  }
  let couponDiscountYen = 0;
  if (terms && !terms.freeShipping) {
    couponDiscountYen = terms.fixed
      ? Math.min(regularSubtotalYen, terms.fixedYen)
      : Math.min(regularSubtotalYen, Math.round(regularSubtotalYen * terms.percent / 100));
  }
  const points = Math.max(0, Math.floor(Number(redeemPoints) || 0));
  const pointsDiscountYen = Math.min(points, Math.max(0, productSubtotalYen - couponDiscountYen));
  const netProductsYen = Math.max(0, productSubtotalYen - couponDiscountYen - pointsDiscountYen);
  return {
    terms,
    productSubtotalYen,
    regularSubtotalYen,
    couponDiscountYen,
    pointsDiscountYen,
    netProductsYen,
    psFeeYen,
    // Pontos zeraram a mercadoria: a taxa PS volta cheia (custo mínimo de
    // separar e despachar), sem negociação nem isenção.
    pointsCoverAllProducts: productSubtotalYen > 0 && pointsDiscountYen > 0 && netProductsYen === 0,
  };
}

/** Desconto final na taxa PS, já com as prioridades: pontos > isenção > negociação. */
export function psFeeDiscountYen({ psFeeYen, pointsCoverAllProducts, psFeeWaived = false, negotiatedDiscountYen = 0 }) {
  if (pointsCoverAllProducts || !(psFeeYen > 0)) return 0;
  if (psFeeWaived) return psFeeYen;
  return Math.max(0, Math.min(psFeeYen, Math.floor(Number(negotiatedDiscountYen) || 0)));
}

/** Teto do desconto que sai aprovado sem a vendedora. */
export function autoApprovablePsDiscountYen(psFeeUnits) {
  return Math.max(0, Math.floor(Number(psFeeUnits) || 0)) * PS_FEE_AUTO_DISCOUNT_PER_UNIT_YEN;
}

/** Imposto de importação dos EUA pré-pago (DDP), em dólar inteiro. */
export function usImportDuty(productsDisplay, currency) {
  if (currency !== 'USD' || !(productsDisplay > 0)) return 0;
  return Math.round(productsDisplay * US_IMPORT_DUTY_RATE + US_ENTRY_FEE_USD);
}

/**
 * Ienes que o cliente digita no campo "Valor" da Wise: o total exibido de volta
 * em ¥ (sem o cushion), na escala da loja. A Wise não tem taxa de PIX, então a
 * base é o total antes delas.
 */
export function wiseTransferYen(amount, currency, rates) {
  const value = Number(amount) || 0;
  if (currency === 'JPY') return Math.round(value);
  const rate = baseRate(currency, rates) * (1 + rateCushion(rates));
  if (!(rate > 0) || !(value > 0)) return 0;
  return roundYen(value / rate);
}

/** IOF + tarifa do banco do PIX direto, sobre o total antes delas. */
export function pixFees(amountBeforeFees, currency) {
  if (currency !== 'BRL' || !(amountBeforeFees > 0)) return { iof: 0, bankFee: 0, total: 0 };
  const iof = Math.round(amountBeforeFees * PIX_IOF_RATE);
  return { iof, bankFee: PIX_BANK_FEE_BRL, total: iof + PIX_BANK_FEE_BRL };
}

/**
 * A conta que o cliente vê, linha por linha, e o total que é cobrado.
 *
 * Tudo inteiro na moeda do cliente, e `total` é a soma exata das linhas:
 * `subtotal − couponDiscount − pointsDiscount = products` e
 * `products + shipping + psFee + importDuty + paymentFee = total`.
 */
export function displayTotals({
  currency,
  rates,
  country,
  paymentMethod,
  lines,
  benefits,
  finalShippingYen,
  psFeeFinalYen,
}) {
  const units = lines.map((line) => (line.freeGift ? 0 : yenToDisplay(line.unitYen, currency, rates)));
  let subtotal = 0;
  let regularSubtotal = 0;
  lines.forEach((line, index) => {
    const lineTotal = units[index] * (Number(line.quantity) || 0);
    subtotal += lineTotal;
    if (couponEligible(line, benefits.terms)) regularSubtotal += lineTotal;
  });

  const terms = benefits.terms;
  let couponDiscount = 0;
  if (terms && !terms.freeShipping && benefits.couponDiscountYen > 0) {
    couponDiscount = terms.fixed
      ? Math.min(regularSubtotal, discountYenToDisplay(benefits.couponDiscountYen, currency, rates))
      : Math.min(regularSubtotal, Math.round(regularSubtotal * terms.percent / 100));
  }
  // Mercadoria zerada em ¥ tem de sair zerada na tela: os pontos absorvem a
  // sobra de arredondamento em vez de cobrar R$ 1 de "produto".
  const room = Math.max(0, subtotal - couponDiscount);
  const pointsDiscount = benefits.pointsDiscountYen > 0
    ? (benefits.netProductsYen === 0 ? room : Math.min(room, discountYenToDisplay(benefits.pointsDiscountYen, currency, rates)))
    : 0;
  const products = Math.max(0, subtotal - couponDiscount - pointsDiscount);
  const shipping = yenToDisplay(finalShippingYen, currency, rates);
  const psFee = yenToDisplay(psFeeFinalYen, currency, rates, { exact: true });
  const importDuty = country === US_COUNTRY ? usImportDuty(products, currency) : 0;
  const beforePaymentFee = products + shipping + psFee + importDuty;
  const fees = paymentMethod === 'pix' ? pixFees(beforePaymentFee, currency) : { iof: 0, bankFee: 0, total: 0 };
  return {
    units,
    subtotal,
    couponDiscount,
    pointsDiscount,
    products,
    shipping,
    psFee,
    importDuty,
    paymentFee: fees.total,
    pixIof: fees.iof,
    pixBankFee: fees.bankFee,
    beforePaymentFee,
    total: beforePaymentFee + fees.total,
    wiseYen: wiseTransferYen(beforePaymentFee, currency, rates),
  };
}

/**
 * Formas de pagamento aceitas por país. PayPay, Yucho e depósito são em ¥ no
 * Japão; PIX é real brasileiro. Cartão e Wise servem para qualquer destino.
 */
export function paymentMethodsForCountry(country) {
  if (country === 'Japão') return ['paypay', 'yucho', 'bank', 'card', 'wise'];
  if (country === 'Brasil') return ['wise', 'pix', 'card'];
  return ['wise', 'card'];
}
