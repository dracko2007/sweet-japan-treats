import { signInAnonymously, signInWithCustomToken, type User } from 'firebase/auth';
import { auth } from '@/config/firebase';

export type CheckoutPaymentMethod = 'bank' | 'paypay' | 'yucho' | 'wise' | 'pix' | 'card';

export interface CheckoutDraft {
  orderId: string;
  paymentMethod: CheckoutPaymentMethod;
  items: Array<{ productId: string; variantId: string; quantity: number }>;
  customer: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
  };
  shippingAddress: {
    postalCode: string;
    prefecture: string;
    state?: string;
    city: string;
    address: string;
    building: string;
    country: string;
  };
  shippingCarrier: string;
  couponCode?: string;
  promoCode?: string;
  pointsToRedeem?: number;
  negotiationId?: string;
  psFeeWaiverToken?: string;
  /** 'local' = pedido só com itens que já estão no país do cliente (preço fixo + frete nacional). */
  fulfillment?: 'local' | 'japan';
  /** Nome do frete nacional escolhido (pedido local com mais de uma opção). */
  localShippingChoice?: string;
  /** Total que o cliente está vendo. Se o servidor calcular outro, nada é cobrado (409 `price_changed`). */
  expectedTotal?: number;
  /** Id da cotação de câmbio usada para montar a tela. */
  ratesId?: string;
}

/**
 * Linhas da conta na moeda do cliente, todas inteiras, calculadas pelo
 * servidor (`shared/money.js`): `subtotal − couponDiscount − pointsDiscount =
 * products` e `products + shipping + psFee + importDuty + paymentFee = total`.
 */
export interface CheckoutPriceBreakdown {
  subtotal: number;
  couponDiscount: number;
  pointsDiscount: number;
  paymentDiscount: number;
  products: number;
  shipping: number;
  /** Parte do frete que é nacional (pedido misto: itens enviados do país do cliente). */
  localShipping?: number;
  psFee: number;
  /** EUA: imposto de importação pré-pago pela loja (DDP). */
  importDuty: number;
  /** PIX direto: IOF + tarifa do banco. */
  paymentFee: number;
  pixIof: number;
  pixBankFee: number;
  /** Ienes para digitar no campo "Valor" da Wise. */
  wiseYen?: number;
  /** Só informativo: não entra no total. */
  tax: number;
}

export interface CheckoutQuote {
  currency: string;
  total: number;
  totalYen: number;
  ratesId: string;
  fxSource: string;
  display: CheckoutPriceBreakdown;
  productSubtotalYen: number;
  couponDiscountYen: number;
  pointsDiscountYen: number;
  redeemPoints: number;
  earnedPoints: number;
  pointsMultiplier: number;
  shippingYen: number;
  shippingDiscountYen: number;
  /** Taxa PS final (já com desconto). */
  psFeeYen: number;
  psFeeDiscountYen: number;
  psFeeWaiverApplied: boolean;
  tax: number;
  items: Array<{
    productId: string;
    requestedId?: string;
    productName: string;
    quantity: number;
    variantId?: string;
    /** Preço unitário na moeda do cliente. */
    price: number;
    unitYen: number;
    freeGift?: boolean;
  }>;
}

export interface AuthoritativeCheckoutOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: CheckoutPaymentMethod;
  currency: string;
  total: number;
  totalPrice: number;
  totalAmount: number;
  totalYen: number;
  orderDate: string;
  trackingCode?: string;
  customerEmail: string;
  customerName: string;
  shippingAddress: CheckoutDraft['shippingAddress'];
  shipping: { carrier: string; cost: number; weightG?: number };
  priceBreakdown?: CheckoutPriceBreakdown | null;
  items: Array<{
    productId: string;
    requestedId: string;
    productName: string;
    image?: string;
    quantity: number;
    size: string;
    variantId: string;
    price: number;
    unitYen: number;
    freeGift?: boolean;
  }>;
  [key: string]: unknown;
}

/** Erro do checkout com o código do servidor (`error`) e, em `price_changed`, a cotação nova. */
export class CheckoutError extends Error {
  code: string;
  quote: CheckoutQuote | null;

  constructor(code: string, quote: CheckoutQuote | null = null) {
    super(code);
    this.name = 'CheckoutError';
    this.code = code;
    this.quote = quote;
  }
}

/** Convidado: login anônimo do Firebase ou a sessão com o token de convidado do servidor (uid `guest_…`). */
export const isGuestUser = (user: Pick<User, 'isAnonymous' | 'uid'> | null | undefined): boolean =>
  Boolean(user && (user.isAnonymous || user.uid.startsWith('guest_')));

// Várias chamadas ao mesmo tempo (cotação + isenção da taxa) não podem criar um convidado cada uma.
let guestSignIn: Promise<User> | null = null;
// O login anônimo está desligado no projeto: não adianta tentar de novo a cada chamada.
let anonymousUnavailable = false;

async function signInGuest(): Promise<User> {
  if (!auth) throw new Error('Autenticação indisponível. Recarregue a página.');
  const firebaseAuth = auth;
  if (!anonymousUnavailable) {
    try {
      return (await signInAnonymously(firebaseAuth)).user;
    } catch {
      anonymousUnavailable = true;
    }
  }
  // Sem login anônimo no Firebase, o servidor emite um token de convidado.
  const response = await fetch('/api/guest-token', { method: 'POST' });
  const payload = await response.json().catch(() => ({})) as { token?: string; error?: string };
  if (!response.ok || !payload.token) throw new CheckoutError(payload.error || 'guest_unavailable');
  return (await signInWithCustomToken(firebaseAuth, payload.token)).user;
}

export async function checkoutToken(): Promise<string> {
  if (!auth) throw new Error('Autenticação indisponível. Recarregue a página.');
  if (auth.currentUser) return auth.currentUser.getIdToken();
  guestSignIn ??= signInGuest().finally(() => { guestSignIn = null; });
  return (await guestSignIn).getIdToken();
}

/** Corpo comum à cotação e à criação: os dois passam pela mesma conta no servidor. */
function checkoutBody(draft: Omit<CheckoutDraft, 'orderId'>) {
  return {
    items: draft.items,
    country: draft.shippingAddress.country,
    prefecture: draft.shippingAddress.prefecture,
    state: draft.shippingAddress.state || '',
    shippingCarrier: draft.shippingCarrier,
    paymentMethod: draft.paymentMethod,
    couponCode: draft.couponCode || '',
    redeemPoints: draft.pointsToRedeem || 0,
    negotiationId: draft.negotiationId || '',
    promoCode: draft.promoCode || '',
    psFeeWaiverToken: draft.psFeeWaiverToken || '',
    ratesId: draft.ratesId || '',
    ...(draft.fulfillment === 'local' ? { fulfillment: 'local', localShippingChoice: draft.localShippingChoice || '' } : {}),
    customer: {
      ...draft.customer,
      postalCode: draft.shippingAddress.postalCode,
      city: draft.shippingAddress.city,
      address: draft.shippingAddress.address,
      building: draft.shippingAddress.building,
    },
  };
}

async function postCheckout<T>(path: string, body: unknown): Promise<T> {
  const token = await checkoutToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string; quote?: CheckoutQuote };
  if (!response.ok) throw new CheckoutError(payload.error || 'checkout_failed', payload.quote || null);
  return payload;
}

/**
 * A conta do servidor para o carrinho, sem criar pedido. É o número que a
 * tela de revisão mostra — e o mesmo que `prepareCheckout` cobra.
 */
export async function quoteCheckout(draft: Omit<CheckoutDraft, 'orderId'>): Promise<CheckoutQuote> {
  const payload = await postCheckout<{ quote?: CheckoutQuote }>('/api/checkout-quote', checkoutBody(draft));
  if (!payload.quote || !(payload.quote.total > 0)) throw new CheckoutError('invalid_quote');
  return payload.quote;
}

export async function prepareCheckout(
  draft: CheckoutDraft,
): Promise<{ order: AuthoritativeCheckoutOrder; clientSecret: string | null }> {
  const payload = await postCheckout<{ order?: AuthoritativeCheckoutOrder; clientSecret?: string | null }>(
    '/api/create-order',
    {
      orderId: draft.orderId,
      ...checkoutBody(draft),
      ...(Number.isFinite(draft.expectedTotal) ? { expectedTotal: draft.expectedTotal } : {}),
    },
  );
  if (!payload.order?.orderNumber) throw new CheckoutError('invalid_order');
  if (draft.paymentMethod === 'card' && !payload.clientSecret) throw new CheckoutError('card_not_initialized');
  return { order: payload.order, clientSecret: payload.clientSecret || null };
}

/** Mensagem para o cliente a partir do código de erro do servidor. */
export function checkoutErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    price_changed: 'O valor mudou desde que você abriu esta tela (câmbio ou desconto). Confira o novo total e confirme de novo.',
    invalid_ps_fee_waiver: 'A isenção da taxa expirou ou já foi usada. O total foi atualizado; tente novamente.',
    ps_fee_waiver_already_used: 'A isenção da taxa expirou ou já foi usada. O total foi atualizado; tente novamente.',
    payment_method_unavailable: 'Esta forma de pagamento não está disponível para o país de entrega.',
    payment_method_disabled: 'Esta forma de pagamento está em manutenção. Escolha outra.',
    shipping_unavailable: 'Esta forma de envio não está disponível para o país de entrega. Volte e escolha outra.',
    insufficient_stock: 'Um dos produtos acabou de esgotar. Revise o carrinho.',
    insufficient_points: 'Você não tem pontos suficientes para esse resgate.',
    coupon_unavailable: 'Este cupom não está mais disponível.',
    coupon_already_used: 'Este cupom já foi usado.',
    coupon_not_found: 'Cupom não encontrado.',
    coupon_minimum_not_met: 'O pedido não atinge o valor mínimo do cupom.',
    negotiation_unavailable: 'A negociação da taxa expirou ou ainda não foi aprovada.',
    negotiation_already_used: 'Esta negociação já foi usada em outro pedido.',
    invalid_negotiation: 'O carrinho mudou desde a negociação. Volte ao checkout e negocie de novo.',
    promotion_unavailable: 'A promoção não está mais disponível.',
    promotion_already_used: 'Você já usou esta promoção.',
    promotion_limit: 'Limite da promoção atingido para este CPF.',
    affiliate_coupon_already_used: 'Este código de afiliado já foi usado neste CPF.',
    local_unavailable: 'Um dos produtos não está mais disponível no seu país. Volte ao carrinho para enviar do Japão.',
    local_shipping_unavailable: 'Este produto ainda não tem frete nacional. Volte ao carrinho para enviar do Japão.',
    promoter_code_already_used: 'Você já usou este código de divulgador. Cada código vale uma vez por cadastro.',
    rate_limited: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  };
  return messages[code] || 'Revise os itens e tente novamente.';
}
