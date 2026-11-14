import { describe, expect, it } from 'vitest';
import { fmtOrderMoney, fmtPair, itemPhoto, orderTotalYen, orderYenView } from './adminOrderMoney';

const pedidoBRL = {
  currency: 'BRL', totalPrice: 451, totalYen: 12702, netProductsYen: 6102, shippingCostYen: 3600, psFeeYen: 3000, couponCode: 'BEMVINDO10',
  items: [
    { productName: 'A', quantity: 1, price: 70, unitYen: 1980, image: 'https://exemplo.com/a.jpg' },
    { productName: 'B', quantity: 2, price: 85, unitYen: 2400, image: 'http://inseguro.com/b.jpg' },
  ],
  priceBreakdown: { subtotal: 240, couponDiscount: 24, pointsDiscount: 0, shipping: 128, psFee: 107, psFeeGross: 107 },
};

describe('dinheiro do pedido no admin', () => {
  it('usa a moeda do pedido em vez de "R$" fixo', () => {
    expect(fmtOrderMoney(5930, 'JPY')).toBe('¥ 5,930');
    expect(fmtOrderMoney(199.4, 'BRL')).toBe('R$ 199');
    expect(fmtOrderMoney(1234, 'BRL')).toBe('R$ 1.234');
    expect(fmtOrderMoney(60, 'USD')).toBe('$ 60.00');
    expect(fmtOrderMoney(12.5, 'EUR')).toBe('€ 13');
  });

  it('igual ao site: moeda do pedido e ienes entre parênteses; em ienes puros, só ienes', () => {
    expect(fmtPair(1980, 70, 'BRL')).toBe('R$ 70 (¥ 1,980)');
    expect(fmtPair(9020, 60, 'USD')).toBe('$ 60.00 (¥ 9,020)');
    expect(fmtPair(5930, 5930, 'JPY')).toBe('¥ 5,930');
    expect(fmtPair(1000, undefined, 'BRL')).toBe('¥ 1,000');
  });

  it('lê o total em ienes do campo atual e do antigo', () => {
    expect(orderTotalYen({ totalYen: 6050 })).toBe(6050);
    expect(orderTotalYen({ grandTotalYen: 4000 })).toBe(4000);
    expect(orderTotalYen({})).toBe(0);
  });

  it('pedido em reais: tudo como no site, da linha do produto ao total', () => {
    const v = orderYenView(pedidoBRL)!;
    expect(v.itemValue(pedidoBRL.items[0])).toBe('R$ 70 (¥ 1,980)');
    expect(v.itemValue(pedidoBRL.items[1])).toBe('R$ 170 (¥ 4,800)');
    expect(v.subtotal).toBe('R$ 240 (¥ 6,780)');
    expect(v.discount).toBe('-R$ 24 (¥ 678)');
    expect(v.shipping).toBe('R$ 128 (¥ 3,600)');
    expect(v.psFee).toBe('R$ 107 (¥ 3,000)');
    expect(v.total).toBe('R$ 451 (¥ 12,702)');
  });

  it('taxa PS isenta aparece como Isenta; frete grátis como Grátis; sem desconto, sem linha', () => {
    const v = orderYenView({ ...pedidoBRL, psFeeYen: 0, psFeeWaiverApplied: true, shippingCostYen: 0, netProductsYen: 6780, totalYen: 6780 })!;
    expect(v.psFee).toBe('Isenta');
    expect(v.psFeeNote).toBe('waived');
    expect(v.shipping).toBe('Grátis');
    expect(v.discount).toBeNull();
  });

  it('pedido em ienes mostra só ienes', () => {
    const v = orderYenView({ currency: 'JPY', totalPrice: 5930, totalYen: 5930, netProductsYen: 5000, shippingCostYen: 930, psFeeYen: 0, psFeeWaiverApplied: true,
      items: [{ quantity: 2, price: 1000, unitYen: 1000 }, { quantity: 1, price: 3000, unitYen: 3000 }] })!;
    expect(v.total).toBe('¥ 5,930');
    expect(v.subtotal).toBe('¥ 5,000');
  });

  it('pedido antigo (sem ienes) ou de estoque local não tem visão em ienes', () => {
    expect(orderYenView({ ...pedidoBRL, totalYen: undefined })).toBeNull();
    expect(orderYenView({ ...pedidoBRL, fulfillment: 'local' })).toBeNull();
    expect(orderYenView({ ...pedidoBRL, items: [{ quantity: 1, price: 5 }] })).toBeNull();
  });

  it('foto só https', () => {
    expect(itemPhoto(pedidoBRL.items[0])).toBe('https://exemplo.com/a.jpg');
    expect(itemPhoto(pedidoBRL.items[1])).toBeNull();
    expect(itemPhoto({})).toBeNull();
  });
});
