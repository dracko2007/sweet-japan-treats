/**
 * Dinheiro do pedido no painel admin, igual ao site: valor na moeda do pedido e os ienes entre
 * parênteses (a moeda em que a loja compra e confere o gasto). Pedido em ienes mostra só ienes.
 *
 * O painel escrevia "R$" fixo (um pedido em ienes aparecia como "R$ 5930.00") e só mostrava
 * ienes em pedidos antigos (`grandTotalYen`). Os pedidos atuais gravam `unitYen` por item,
 * `netProductsYen`, `shippingCostYen`, `psFeeYen` e `totalYen`.
 */

const SYMBOL: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€', JPY: '¥' };

export interface OrderItemMoney { productName?: string; name?: string; quantity?: number; price?: number; unitYen?: number; freeGift?: boolean; image?: string }

export interface OrderMoneyFields {
  currency?: string;
  totalPrice?: number;
  total?: number;
  totalYen?: number;
  grandTotalYen?: number;
  netProductsYen?: number;
  shippingCostYen?: number;
  psFeeYen?: number;
  psFeeWaiverApplied?: boolean;
  fulfillment?: string;
  items?: OrderItemMoney[];
  priceBreakdown?: {
    subtotal?: number; couponDiscount?: number; pointsDiscount?: number; shipping?: number;
    psFee?: number; psFeeGross?: number;
  };
}

/**
 * Valor na moeda do pedido, no MESMO formato do site (`utils/currency.ts`): reais e euros
 * inteiros, dólar com centavos, ienes com separador de milhar.
 */
export function fmtOrderMoney(value: number | undefined | null, currency?: string): string {
  const code = String(currency || 'BRL').toUpperCase();
  const amount = Number(value) || 0;
  if (code === 'JPY') return `¥ ${Math.round(amount).toLocaleString('en-US')}`;
  if (code === 'USD') return `$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (code === 'EUR') return `€ ${Math.round(amount).toLocaleString('pt-BR')}`;
  return `R$ ${Math.round(amount).toLocaleString('pt-BR')}`;
}

export function yen(value: number): string {
  return `¥ ${Math.round(value).toLocaleString('en-US')}`;
}

/**
 * Como o site mostra: "R$ 70 (¥ 1,980)", moeda do pedido primeiro e os ienes entre parênteses.
 * Pedido em ienes (ou sem o valor na moeda do cliente) mostra só ienes.
 */
export function fmtPair(yenValue: number, localValue: number | undefined | null, currency?: string): string {
  const code = String(currency || '').toUpperCase();
  if (code === 'JPY' || localValue == null || !Number.isFinite(Number(localValue))) return yen(yenValue);
  return `${fmtOrderMoney(localValue, code || 'BRL')} (${yen(yenValue)})`;
}

/** Total em ienes do pedido (campo atual, ou o antigo). 0 quando o pedido não guardou. */
export function orderTotalYen(order: OrderMoneyFields): number {
  return Number(order.totalYen ?? order.grandTotalYen) || 0;
}

export interface OrderYenView {
  itemValue: (item: OrderItemMoney) => string;
  subtotal: string;
  discount: string | null;
  shipping: string;
  psFee: string | null;
  psFeeNote: 'waived' | null;
  total: string;
}

/**
 * Visão do pedido em ienes + moeda do cliente. Devolve null quando o pedido não tem os valores
 * em ienes (pedido antigo) ou é de estoque local (frete nacional na moeda do cliente): nesses
 * casos o painel segue na moeda do pedido.
 */
export function orderYenView(order: OrderMoneyFields): OrderYenView | null {
  if (order.fulfillment === 'local' || order.fulfillment === 'mixed') return null;
  const totalYen = Number(order.totalYen) || 0;
  const items = Array.isArray(order.items) ? order.items : [];
  if (!(totalYen > 0) || items.some((i) => !i.freeGift && !(Number(i.unitYen) > 0))) return null;
  const cur = order.currency;
  const pb = order.priceBreakdown || {};
  const qty = (i: OrderItemMoney) => Math.max(1, Number(i.quantity || 1));
  const subtotalYen = items.reduce((sum, i) => sum + (i.freeGift ? 0 : Number(i.unitYen) * qty(i)), 0);
  const localSubtotal = pb.subtotal ?? items.reduce((sum, i) => sum + (i.freeGift ? 0 : Number(i.price || 0) * qty(i)), 0);
  const netYen = order.netProductsYen != null ? Number(order.netProductsYen) : subtotalYen;
  const discountYen = Math.max(0, subtotalYen - netYen);
  const localDiscount = (Number(pb.couponDiscount) || 0) + (Number(pb.pointsDiscount) || 0);
  const psFeeYen = Number(order.psFeeYen) || 0;
  const waived = psFeeYen === 0 && order.psFeeWaiverApplied === true;
  return {
    itemValue: (item) => (item.freeGift ? 'Brinde' : fmtPair(Number(item.unitYen) * qty(item), Number(item.price || 0) * qty(item), cur)),
    subtotal: fmtPair(subtotalYen, localSubtotal, cur),
    discount: discountYen > 0 ? `-${fmtPair(discountYen, localDiscount > 0 ? localDiscount : undefined, cur)}` : null,
    shipping: Number(order.shippingCostYen) > 0 ? fmtPair(Number(order.shippingCostYen), pb.shipping, cur) : 'Grátis',
    psFee: psFeeYen > 0 ? fmtPair(psFeeYen, pb.psFee, cur) : waived ? 'Isenta' : null,
    psFeeNote: waived ? 'waived' : null,
    total: fmtPair(totalYen, order.totalPrice ?? order.total, cur),
  };
}

/** Foto https do produto (ou null): o admin e o e-mail só mostram imagem segura. */
export function itemPhoto(item: { image?: string }): string | null {
  try {
    const url = new URL(String(item.image || ''));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
