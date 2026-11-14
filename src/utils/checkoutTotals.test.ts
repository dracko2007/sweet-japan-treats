import { describe, expect, it, vi } from 'vitest';
import type { CartItem, Product } from '@/types';
import { yenToDisplay } from '../../shared/money.js';

// A tela (checkout e revisão) e o servidor (`buildQuote`) têm de chegar ao
// MESMO total para a mesma compra — é o valor que o cliente vê e o que é
// cobrado. Este teste monta a compra dos dois lados, com o frete da
// calculadora do site, e compara linha por linha.
const RATES = vi.hoisted(() => ({ BRL: 1 / 28, EUR: 0.16 / 28, USD: 1 / 150, source: 'open-er' }));

vi.mock('@/services/fxService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/fxService')>();
  return {
    ...original,
    getMoneyRates: () => RATES,
    convertYen: (yen: number, currency: string, noBuffer = false) => yenToDisplay(yen, currency, RATES, { exact: noBuffer }),
  };
});

const { computeCheckoutTotals } = await import('./checkoutTotals');
const { quoteShipping } = await import('./shippingQuote');
const { splitCart } = await import('./localStock');
const { buildQuote } = await import('../../api/_lib/commerce.js');

const mask = {
  id: 'mask',
  name: 'Mask',
  prices: { small: 1450, large: 2800 },
  weightGrams: 120,
  stock: { unlimited: true },
} as unknown as Product;
const serum = {
  id: 'serum',
  name: 'Serum',
  prices: { small: 1800, large: 3300 },
  discountPercent: 10,
  weightGrams: 300,
  stock: { unlimited: true },
} as unknown as Product;
const box = {
  id: 'box',
  name: 'Box',
  prices: { small: 900, large: 900 },
  noPsFee: true,
  weightGrams: 200,
  stock: { unlimited: true },
} as unknown as Product;

// Produto que já está no Brasil: preço fixo em R$, 12 unidades, frete nacional por região.
const sabonete = {
  id: 'sabonete',
  name: 'Sabonete',
  prices: { small: 1300, large: 1300 },
  discountPercent: 15,
  weightGrams: 400,
  stock: { unlimited: true },
  localStock: { Brasil: { enabled: true, price: 200, quantity: 12, shippingOptions: [{ name: 'Sul', price: 30 }, { name: 'Sudeste', price: 22 }] } },
} as unknown as Product;

const brinde = {
  id: 'brinde',
  name: 'Brinde frete grátis',
  prices: { small: 1200, large: 1200 },
  freeShippingSolo: true,
  weightGrams: 150,
  stock: { unlimited: true },
} as unknown as Product;

const catalog = new Map([mask, serum, box, sabonete, brinde].map((product) => [product.id, product]));

interface Scenario {
  country: string;
  prefecture?: string;
  carrier: string;
  paymentMethod: string;
  items: CartItem[];
  coupon?: Record<string, unknown> | null;
  redeemPoints?: number;
  psFeeWaived?: boolean;
  negotiation?: Record<string, unknown> | null;
  /** Pedido com itens do estoque do país do cliente (mesma regra da tela e do servidor). */
  local?: boolean;
}

function both(scenario: Scenario) {
  const { country, prefecture = '', carrier, paymentMethod, items, coupon = null, redeemPoints = 0, psFeeWaived = false, negotiation = null, local = false } = scenario;
  // No pedido misto o frete internacional só considera os itens que vêm do Japão.
  const japanItems = local ? splitCart(items, country).japanItems : items;
  const shipping = quoteShipping(japanItems, country, { prefecture });
  const option = shipping.options.find((entry) => entry.carrier === carrier);
  // Tudo sai do país do cliente: não há frete do Japão.
  if (!option && japanItems.length > 0) throw new Error(`no ${carrier} for ${country}`);
  const shippingYen = !option ? 0 : country === 'Japão' ? option.cost : option.costYen ?? 0;

  const server = buildQuote({
    requestedItems: items.map((item) => ({ productId: item.product.id, variantId: item.size, quantity: item.quantity })),
    products: catalog,
    country,
    prefecture,
    state: '',
    carrier,
    paymentMethod,
    coupon,
    redeemPoints,
    negotiation,
    campaign: null,
    homePromotion: null,
    rates: RATES,
    recentSpendYen: 0,
    psFeeWaived,
    ...(local ? { fulfillment: 'local' } : {}),
  });
  const negotiated = negotiation && ['approved', 'auto_approved'].includes(String(negotiation.status))
    ? { status: String(negotiation.status), approvedDiscountYen: Number(negotiation.approvedDiscountYen) }
    : null;
  const screen = computeCheckoutTotals({
    items,
    currency: server.currency,
    country,
    paymentMethod,
    coupon,
    redeemPoints,
    shippingYen,
    psFeeWaived,
    negotiatedPsFee: negotiated,
    local: local ? { country, currency: server.currency, shippingDisplay: server.fulfillment === 'local' ? server.display.shipping : server.display.localShipping } : null,
  });
  return { server, screen: screen.shown };
}

function expectSameBill({ server, screen }: ReturnType<typeof both>) {
  expect(screen.total).toBe(server.total);
  expect({
    subtotal: screen.subtotal,
    couponDiscount: screen.couponDiscount,
    pointsDiscount: screen.pointsDiscount,
    products: screen.products,
    shipping: screen.shipping,
    psFee: screen.psFee,
    importDuty: screen.importDuty,
    paymentFee: screen.paymentFee,
    wiseYen: screen.wiseYen,
  }).toEqual({
    subtotal: server.display.subtotal,
    couponDiscount: server.display.couponDiscount,
    pointsDiscount: server.display.pointsDiscount,
    products: server.display.products,
    shipping: server.display.shipping,
    psFee: server.display.psFee,
    importDuty: server.display.importDuty,
    paymentFee: server.display.paymentFee,
    wiseYen: server.display.wiseYen,
  });
  // Toda linha é inteira e o total é a soma delas.
  const lines = [screen.products, screen.shipping, screen.psFee, screen.importDuty, screen.paymentFee];
  lines.forEach((value) => expect(Number.isInteger(value)).toBe(true));
  expect(lines.reduce((sum, value) => sum + value, 0)).toBe(screen.total);
}

const cart = (...entries: Array<[Product, number, string?]>): CartItem[] =>
  entries.map(([product, quantity, size = 'small']) => ({ product, quantity, size }));

describe('screen total equals the charged total', () => {
  it('Brasil, cartão, EMS', () => {
    expectSameBill(both({ country: 'Brasil', carrier: 'ems', paymentMethod: 'card', items: cart([mask, 2], [serum, 1]) }));
  });

  it('frete grátis do produto: tela e servidor concordam, sozinho (¥0) e com outro item (cobrado)', () => {
    const sozinho = both({ country: 'Brasil', carrier: 'ems', paymentMethod: 'card', items: cart([brinde, 1]) });
    expectSameBill(sozinho);
    expect(sozinho.server.display.shipping).toBe(0);
    const comOutro = both({ country: 'Brasil', carrier: 'ems', paymentMethod: 'card', items: cart([brinde, 1], [mask, 1]) });
    expectSameBill(comOutro);
    expect(comOutro.server.display.shipping).toBeGreaterThan(0);
    const duas = both({ country: 'Brasil', carrier: 'ems', paymentMethod: 'card', items: cart([brinde, 2]) });
    expectSameBill(duas);
    expect(duas.server.display.shipping).toBeGreaterThan(0);
  });

  it('Brasil, Wise, Air Packet, com cupom de 10% e pontos', () => {
    expectSameBill(both({
      country: 'Brasil',
      carrier: 'eraito',
      paymentMethod: 'wise',
      items: cart([mask, 3]),
      coupon: { code: 'DEZ', discount: 10, discountType: 'percentage' },
      redeemPoints: 700,
    }));
  });

  it('Brasil, PIX: IOF e tarifa entram no total', () => {
    const result = both({ country: 'Brasil', carrier: 'ems', paymentMethod: 'pix', items: cart([mask, 1], [box, 1]) });
    expectSameBill(result);
    expect(result.server.display.paymentFee).toBeGreaterThan(32);
  });

  it('Portugal, cupom fixo em ienes', () => {
    expectSameBill(both({
      country: 'Portugal',
      carrier: 'ems',
      paymentMethod: 'card',
      items: cart([serum, 2]),
      coupon: { code: 'MENOS500', discount: 500, discountType: 'fixed' },
    }));
  });

  it('EUA: só EMS, com o imposto pré-pago no total', () => {
    const result = both({ country: 'Estados Unidos', carrier: 'ems', paymentMethod: 'card', items: cart([mask, 2], [serum, 1]) });
    expectSameBill(result);
    expect(result.server.display.importDuty).toBeGreaterThan(0);
    expect(quoteShipping(cart([mask, 1]), 'Estados Unidos').options.map((option) => option.carrier)).toEqual(['ems']);
  });

  it('Japão, ienes, frete doméstico', () => {
    expectSameBill(both({ country: 'Japão', prefecture: 'Tokyo', carrier: 'yuubin', paymentMethod: 'paypay', items: cart([mask, 1]) }));
  });

  it('Japão acima de ¥6000: frete grátis dos dois lados', () => {
    const result = both({ country: 'Japão', prefecture: 'Tokyo', carrier: 'yamato', paymentMethod: 'bank', items: cart([mask, 3], [serum, 2]) });
    expectSameBill(result);
    expect(result.server.display.shipping).toBe(0);
  });

  it('negociação automática de ¥300 por item', () => {
    const result = both({
      country: 'Brasil',
      carrier: 'ems',
      paymentMethod: 'card',
      items: cart([mask, 2]),
      negotiation: {
        type: 'ps_fee',
        status: 'auto_approved',
        approvedBy: 'system',
        approvedDiscountYen: 600,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    expectSameBill(result);
    expect(result.server.psFeeYen).toBe(1400);
  });

  it('isenção da taxa PS (oferta de saída)', () => {
    const result = both({ country: 'Brasil', carrier: 'ems', paymentMethod: 'card', items: cart([mask, 1]), psFeeWaived: true });
    expectSameBill(result);
    expect(result.server.display.psFee).toBe(0);
  });

  // Um pedido, dois envios: itens do Brasil (preço fixo + frete nacional) e do Japão (conta de sempre).
  describe('carrinho misto (Brasil + Japão)', () => {
    const itens = () => cart([sabonete, 1], [mask, 2], [serum, 1]);

    it('cartão e Wise: tela = servidor, com os dois fretes', () => {
      const result = both({ country: 'Brasil', prefecture: 'SP', carrier: 'ems', paymentMethod: 'card', items: itens(), local: true });
      expect(result.server.fulfillment).toBe('mixed');
      expect(result.server.display.localShipping).toBe(22);
      expectSameBill(result);
      expectSameBill(both({ country: 'Brasil', prefecture: 'RS', carrier: 'ems', paymentMethod: 'wise', items: itens(), local: true }));
    });

    it('PIX: IOF e tarifa só sobre a parte do Japão, igual na tela e no servidor', () => {
      const result = both({ country: 'Brasil', prefecture: 'SP', carrier: 'ems', paymentMethod: 'pix', items: itens(), local: true });
      expectSameBill(result);
      expect(result.screen.paymentFee).toBeGreaterThan(0);
    });

    it('com cupom percentual e pontos', () => {
      expectSameBill(both({
        country: 'Brasil', prefecture: 'SP', carrier: 'ems', paymentMethod: 'card', items: itens(), local: true,
        coupon: { code: 'X10', discount: 10, discountType: 'percentage' }, redeemPoints: 300,
      }));
    });

    it('todos do Brasil: continua igual (só frete nacional, sem taxa PS)', () => {
      const result = both({ country: 'Brasil', prefecture: 'SP', carrier: 'ems', paymentMethod: 'card', items: cart([sabonete, 2]), local: true });
      expect(result.server.fulfillment).toBe('local');
      expect(result.screen.psFee).toBe(0);
      expect(result.screen.total).toBe(400 + 22);
    });
  });
});
