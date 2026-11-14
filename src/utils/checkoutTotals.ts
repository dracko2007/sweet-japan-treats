// Conta do checkout no navegador — a MESMA do servidor (`shared/money.js`,
// chamada por `api/_lib/commerce.js`). O checkout e a revisão usam isto para
// mostrar o total antes da cotação do servidor chegar; com a mesma cotação de
// câmbio, o número é idêntico ao que o servidor cobra.
import type { CartItem } from '@/types';
import { effectiveYen } from '@/utils/pricing';
import { getMoneyRates } from '@/services/fxService';
import {
  autoApprovablePsDiscountYen,
  displayTotals,
  productBenefits,
  psFeeDiscountYen as finalPsFeeDiscountYen,
  soloFreeShipping,
} from '../../shared/money.js';
import { localUnitYen } from '../../shared/local-stock.js';
import { localOffer, splitCart } from '@/utils/localStock';

export interface CheckoutCoupon {
  code?: string;
  discount?: number;
  discountType?: string;
  type?: string;
  discountPercent?: number;
  freeShipping?: boolean;
  affiliateCode?: string;
  minOrderValue?: number;
}

/** Pedido com itens do estoque do país do cliente: país, moeda e frete nacional (na moeda dele). */
export interface LocalCheckout {
  country: string;
  currency: string;
  shippingDisplay: number;
}

/**
 * Itens que saem do país do cliente (preço fixo na moeda dele): os que o estoque de lá cobre por
 * inteiro. O resto do carrinho sai do Japão, no mesmo pedido (mesma regra do servidor).
 */
function localItemSet(items: CartItem[], country: string): Set<CartItem> {
  return new Set(splitCart(items, country).localItems);
}

/** Linhas do pedido: preço fixo local nos itens do país do cliente, conta do Japão nos demais. */
export function checkoutMoneyLines(items: CartItem[], local: LocalCheckout | null = null) {
  const localItems = local ? localItemSet(items, local.country) : null;
  const rates = local ? getMoneyRates() : null;
  return items.map((item) => {
    if (local && localItems?.has(item)) {
      const price = localOffer(item.product, local.country)?.price || 0;
      return {
        unitYen: localUnitYen(price, local.currency, rates),
        unitDisplay: price,
        quantity: item.quantity,
        freeGift: false,
        homePromo: false,
        productDiscounted: false,
        noPsFee: true,
      };
    }
    return {
      unitYen: item.freeGift ? 0 : effectiveYen(item.product, item.size),
      quantity: item.quantity,
      freeGift: Boolean(item.freeGift),
      homePromo: item.product.id.endsWith('_promo'),
      productDiscounted: Number(item.product.discountPercent || 0) > 0,
      noPsFee: Boolean(item.product.noPsFee),
    };
  });
}

/** Cupom e pontos em ¥ sobre o carrinho, sem frete nem taxa (para limitar o resgate). */
export function cartBenefits(items: CartItem[], coupon: CheckoutCoupon | null = null, redeemPoints = 0, local: LocalCheckout | null = null) {
  return productBenefits({ lines: checkoutMoneyLines(items, local), coupon, redeemPoints });
}

/** Unidades que pagam a taxa PS (brinde, produto isento e item enviado do país do cliente ficam fora). */
export function psFeeUnits(items: CartItem[], local: LocalCheckout | null = null): number {
  const localItems = local ? localItemSet(items, local.country) : null;
  return items.reduce((sum, item) => (item.freeGift || item.product.noPsFee || localItems?.has(item) ? sum : sum + item.quantity), 0);
}

export interface NegotiatedPsFee {
  /** 'approved' (vendedora) ou 'auto_approved' (servidor, até ¥300 por item). */
  status: string;
  approvedDiscountYen: number;
}

interface TotalsInput {
  items: CartItem[];
  currency: string;
  country: string;
  /** Vazio no checkout (a forma de pagamento só é escolhida na revisão). */
  paymentMethod?: string;
  coupon?: CheckoutCoupon | null;
  /** Pontos pedidos; são limitados ao que a mercadoria comporta. */
  redeemPoints?: number;
  /** Frete em ¥ antes de cupom e negociação. */
  shippingYen: number;
  /** Desconto de frete aprovado pela vendedora, em ¥. */
  shippingDiscountYen?: number;
  psFeeWaived?: boolean;
  negotiatedPsFee?: NegotiatedPsFee | null;
  /** Itens do estoque do país (preço fixo + frete nacional). Se TODOS são de lá, ignora frete em ¥, isenção e negociação. */
  local?: LocalCheckout | null;
}

export function computeCheckoutTotals({
  items,
  currency,
  country,
  paymentMethod = '',
  coupon = null,
  redeemPoints = 0,
  shippingYen,
  shippingDiscountYen = 0,
  psFeeWaived = false,
  negotiatedPsFee = null,
  local = null,
}: TotalsInput) {
  // Todos os itens saem do país do cliente: não há frete do Japão, isenção nem negociação.
  const allLocal = Boolean(local) && splitCart(items, local!.country).kind === 'local';
  if (allLocal) {
    psFeeWaived = false;
    negotiatedPsFee = null;
    shippingDiscountYen = 0;
    shippingYen = 0;
  }
  const lines = checkoutMoneyLines(items, local);
  const benefits = productBenefits({ lines, coupon, redeemPoints });
  const units = psFeeUnits(items, local);
  const maxAutoYen = autoApprovablePsDiscountYen(units);

  // Mesma regra do servidor: aprovação manual vale o que a vendedora deu;
  // automática é limitada a ¥300 × unidades do carrinho ATUAL.
  let negotiatedYen = 0;
  if (negotiatedPsFee?.status === 'approved') negotiatedYen = negotiatedPsFee.approvedDiscountYen;
  else if (negotiatedPsFee?.status === 'auto_approved') negotiatedYen = Math.min(negotiatedPsFee.approvedDiscountYen, maxAutoYen);
  const psDiscountYen = finalPsFeeDiscountYen({
    psFeeYen: benefits.psFeeYen,
    pointsCoverAllProducts: benefits.pointsCoverAllProducts,
    psFeeWaived,
    negotiatedDiscountYen: negotiatedYen,
  });
  const psFeeFinalYen = benefits.psFeeYen - psDiscountYen;

  const localItems = local ? localItemSet(items, local.country) : null;
  const soloFree = soloFreeShipping(items.map((item) => ({
    quantity: item.quantity,
    freeShippingSolo: item.product.freeShippingSolo,
    local: localItems?.has(item),
  })));
  const freeShipping = benefits.terms?.freeShipping === true || soloFree;
  const baseShippingYen = freeShipping ? 0 : Math.max(0, Number(shippingYen) || 0);
  const appliedShippingDiscountYen = Math.min(baseShippingYen, Math.max(0, Number(shippingDiscountYen) || 0));
  const finalShippingYen = baseShippingYen - appliedShippingDiscountYen;

  const rates = getMoneyRates();
  const shown = displayTotals({
    currency,
    rates,
    country,
    paymentMethod,
    lines,
    benefits,
    finalShippingYen,
    psFeeFinalYen,
    local: allLocal,
    shippingDisplay: allLocal ? (freeShipping ? 0 : local!.shippingDisplay) : null,
    localShippingDisplay: local && !allLocal ? (freeShipping ? 0 : local.shippingDisplay) : 0,
  });

  return {
    lines,
    benefits,
    shown,
    psFeeUnits: units,
    maxAutoYen,
    psFeeYen: benefits.psFeeYen,
    psFeeDiscountYen: psDiscountYen,
    psFeeFinalYen,
    shippingBaseYen: Math.max(0, Number(shippingYen) || 0),
    shippingDiscountYen: appliedShippingDiscountYen,
    finalShippingYen,
  };
}
