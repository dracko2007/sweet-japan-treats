import { describe, expect, it } from 'vitest';
import { buildQuote } from './commerce.js';

const rates = { BRL: 1 / 28, EUR: 0.16 / 28, USD: 1 / 150, source: 'fallback' };
const product = {
  id: 'p1',
  name: 'Produto',
  prices: { small: 1000, large: 2000 },
  weightGrams: 500,
  stock: { unlimited: false, quantity: 10 },
};

function quote(overrides = {}) {
  return buildQuote({
    requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 1 }],
    products: new Map([['p1', product]]),
    country: 'Brasil',
    prefecture: 'SP',
    state: 'SP',
    carrier: 'ems',
    paymentMethod: 'card',
    coupon: null,
    redeemPoints: 0,
    negotiation: null,
    campaign: null,
    homePromotion: null,
    rates,
    ...overrides,
  });
}

describe('authoritative checkout quote', () => {
  it('derives item price and regional currency from server data', () => {
    const result = quote({ requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 2, price: 1, total: 1 }] });
    expect(result.items[0].unitYen).toBe(1000);
    expect(result.productSubtotalYen).toBe(2000);
    expect(result.netProductsYen).toBe(1900);
    expect(result.currency).toBe('BRL');
    expect(result.total).toBeGreaterThan(1);
  });

  it('uses USD outside Brazil, Japan, and the eurozone', () => {
    expect(quote({ country: 'Canadá' }).currency).toBe('USD');
    expect(quote({ country: 'Portugal' }).currency).toBe('EUR');
    expect(quote({ country: 'Japão', prefecture: 'Tokyo', carrier: 'yuubin' }).currency).toBe('JPY');
  });

  it('rejects a home promotion quantity above the per-person limit', () => {
    expect(() => quote({
      requestedItems: [{ productId: 'p1_promo', variantId: 'small', quantity: 2 }],
      homePromotion: { productId: 'p1', promoPriceYen: 500, limitPerPerson: 1, maxProducts: 10, soldCount: 0 },
    })).toThrowError('promotion_limit');
  });

  it('reconstructs campaign gifts instead of trusting free client lines', () => {
    const gift = { ...product, id: 'gift', name: 'Brinde', stock: { unlimited: false, quantity: 4 } };
    const result = quote({
      products: new Map([['p1', product], ['gift', gift]]),
      campaign: { mechanic: 'bogo_other', productId: 'p1', giftProductId: 'gift', keepProductDiscount: true },
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[1]).toMatchObject({ productId: 'gift', freeGift: true, unitYen: 0, quantity: 1 });
  });

  it('rejects a carrier that is unavailable for the cart weight', () => {
    expect(() => quote({ carrier: 'kozutsumi-air' })).toThrowError('invalid_shipping');
  });
});
