// Estoque local no navegador: o que mostrar e como fechar o pedido quando o
// produto já está no país do cliente. A regra em si mora em shared/local-stock.js
// (a mesma do servidor).
import type { CartItem, Product } from '@/types';
import { safeStorage } from '@/utils/storage';
import { localOffer as sharedLocalOffer, localOrderShipping, shippingChoiceNames } from '../../shared/local-stock.js';

export interface LocalOffer { price: number; quantity: number; shippingOptions: { name: string; price: number }[] }

/** Oferta local do produto para o país do cliente (preço fixo na moeda de lá), ou null. */
export const localOffer = (product: Product | undefined | null, country: string): LocalOffer | null =>
  (product ? sharedLocalOffer(product, country) : null) as LocalOffer | null;

// O cliente pode preferir receber tudo num envio só, do Japão (carrinho misto).
const FORCE_KEY = 'ship_all_from_japan';
export const shipAllFromJapan = (): boolean => safeStorage.getItem(FORCE_KEY) === '1';
export function setShipAllFromJapan(value: boolean): void {
  if (value) safeStorage.setItem(FORCE_KEY, '1');
  else safeStorage.removeItem(FORCE_KEY);
  window.dispatchEvent(new Event('fulfillment-changed'));
}

export interface CartSplit {
  /** 'local' = todos os itens saem do país do cliente; 'mixed' = parte de lá, parte do Japão. */
  kind: 'japan' | 'local' | 'mixed';
  localItems: CartItem[];
  japanItems: CartItem[];
}

/** Separa o carrinho entre o que tem estoque no país do cliente e o que vem do Japão. */
export function splitCart(items: CartItem[], country: string): CartSplit {
  const wanted = new Map<string, number>();
  for (const item of items) if (!item.freeGift) wanted.set(item.product.id, (wanted.get(item.product.id) || 0) + item.quantity);
  const localItems: CartItem[] = [];
  const japanItems: CartItem[] = [];
  for (const item of items) {
    const offer = item.freeGift || item.product.id.endsWith('_promo') ? null : localOffer(item.product, country);
    // Só é local se o estoque de lá cobre TODAS as unidades pedidas do produto.
    if (offer && (wanted.get(item.product.id) || 0) <= offer.quantity) localItems.push(item);
    else japanItems.push(item);
  }
  const kind = localItems.length === 0 ? 'japan' : japanItems.length === 0 ? 'local' : 'mixed';
  return { kind, localItems, japanItems };
}

/** O pedido deste carrinho sai do país do cliente? (todo local e o cliente não pediu envio único do Japão) */
export function isLocalOrder(items: CartItem[], country: string): boolean {
  return items.length > 0 && splitCart(items, country).kind === 'local' && !shipAllFromJapan();
}

/** Preço fixo local de um item do carrinho, quando ele vale; senão null (usa a conta do Japão). */
export function localUnitPrice(item: CartItem, country: string, local: boolean): number | null {
  if (!local || item.freeGift) return null;
  return localOffer(item.product, country)?.price ?? null;
}

// ---- "Enviar separado": itens do Japão guardados enquanto o pedido local é fechado ----
const DEFERRED_KEY = 'cart_deferred_japan';
export interface DeferredItem { productId: string; size: string; quantity: number }

export function deferredJapanItems(): DeferredItem[] {
  try {
    const parsed = JSON.parse(safeStorage.getItem(DEFERRED_KEY) || '[]') as DeferredItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.productId && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

/** Soma aos já guardados (o cliente pode escolher "separado" mais de uma vez). */
export function deferJapanItems(items: CartItem[]): void {
  const all = [...deferredJapanItems(), ...items.filter((item) => !item.freeGift).map((item) => ({ productId: item.product.id, size: item.size, quantity: item.quantity }))];
  safeStorage.setItem(DEFERRED_KEY, JSON.stringify(all));
}

export function clearDeferredJapanItems(): void {
  safeStorage.removeItem(DEFERRED_KEY);
}

/** Frete nacional do pedido local para este cliente, ou null enquanto ele precisa escolher. */
export function localShippingFor(items: CartItem[], country: string, state: string, choice = ''): { name: string; price: number } | null {
  const offers = items.filter((item) => !item.freeGift).map((item) => localOffer(item.product, country));
  return localOrderShipping(offers, { country, state, choice }) as { name: string; price: number } | null;
}

/** Opções que o cliente pode escolher (com o valor que cada uma custaria no pedido todo). */
export function localShippingChoices(items: CartItem[], country: string, state: string): { name: string; price: number }[] {
  const offers = items.filter((item) => !item.freeGift).map((item) => localOffer(item.product, country));
  return (shippingChoiceNames(offers) as string[])
    .map((name) => localOrderShipping(offers, { country, state, choice: name }) as { name: string; price: number } | null)
    .filter((option): option is { name: string; price: number } => option !== null);
}
