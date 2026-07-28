// A tela do checkout prometia 100 pontos e o servidor creditava 85 quando havia
// cupom e pagamento em PIX: eram duas contas diferentes para a mesma regra.
//
// A regra escolhida é a generosa — desconto não corta ponto. O cliente ganha
// sobre o valor cheio da mercadoria. Estes testes prendem as duas pontas na
// mesma função e fixam o que NÃO gera ponto.
import { describe, expect, it } from 'vitest';
import { buildQuote } from './commerce.js';
import { earnedPointsForOrder } from '../../shared/points.js';

const rates = { BRL: 1 / 28, EUR: 0.16 / 28, USD: 1 / 150, source: 'fallback' };
const produto = {
  id: 'p1', name: 'Produto',
  prices: { small: 5000, large: 5000 },
  variants: [{ id: 'small', label: 'Único', price: 5000 }],
  weightGrams: 300,
  stock: { unlimited: true },
};

/** Pedido de 2 unidades de ¥5.000 = ¥10.000 em mercadoria. */
function pedido(extra = {}) {
  return buildQuote({
    requestedItems: [{ productId: 'p1', variantId: 'small', quantity: 2 }],
    products: new Map([['p1', produto]]),
    country: 'Brasil', prefecture: '', state: 'SP', carrier: 'ems',
    paymentMethod: 'wise', coupon: null, redeemPoints: 0,
    negotiation: null, campaign: null, homePromotion: null, rates,
    ...extra,
  });
}

const CUPOM_10 = { code: 'X', discountType: 'percentage', discount: 10, source: 'global' };

describe('pontos do pedido', () => {
  it('1 ponto a cada ¥100 de mercadoria', () => {
    expect(pedido().earnedPoints).toBe(100);
  });

  // Frete (¥3.900) e taxa do personal shopper (¥1.000 por item) entram no total
  // pago, mas não na base de pontos: ponto é sobre mercadoria.
  it('frete e taxa do personal shopper não geram ponto', () => {
    const q = pedido();

    expect(q.psFeeYen).toBe(2000);
    expect(q.shippingYen).toBeGreaterThan(0);
    // ¥10.000 + ¥2.000 + frete pagos, e ainda assim 100 pontos.
    expect(q.earnedPoints).toBe(100);
  });

  it('cupom não corta ponto', () => {
    const q = pedido({ coupon: CUPOM_10 });

    expect(q.couponDiscountYen).toBe(1000);
    expect(q.earnedPoints).toBe(100);
  });

  it('desconto de pagamento (PIX/cartão) não corta ponto', () => {
    expect(pedido({ paymentMethod: 'pix' }).earnedPoints).toBe(100);
    expect(pedido({ paymentMethod: 'card' }).earnedPoints).toBe(100);
  });

  it('cupom e PIX juntos continuam pagando os 100', () => {
    expect(pedido({ paymentMethod: 'pix', coupon: CUPOM_10 }).earnedPoints).toBe(100);
  });

  // Sem isto o resgate se pagaria sozinho: ¥1.000 em pontos viraria ¥1.000 de
  // compra que devolve mais 10 pontos, sem fim.
  it('o que foi pago com pontos sai da base', () => {
    const q = pedido({ redeemPoints: 3000 });

    expect(q.redeemPoints).toBe(3000);
    expect(q.earnedPoints).toBe(70); // (10.000 − 3.000) / 100
  });

  // A tela do checkout chama exatamente esta função com os mesmos argumentos.
  it('a tela e o servidor chegam ao mesmo número', () => {
    for (const extra of [{}, { paymentMethod: 'pix' }, { coupon: CUPOM_10 }, { redeemPoints: 2500 }]) {
      const q = pedido(extra);
      expect(earnedPointsForOrder(q.productSubtotalYen, q.redeemPoints)).toBe(q.earnedPoints);
    }
  });

  it('não devolve ponto negativo quando o resgate cobre tudo', () => {
    expect(earnedPointsForOrder(10000, 99999)).toBe(0);
    expect(earnedPointsForOrder(0, 0)).toBe(0);
  });
});
