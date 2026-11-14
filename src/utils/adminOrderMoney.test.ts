import { describe, expect, it } from 'vitest';
import { fmtOrderMoney, orderTotalYen, orderYenLines } from './adminOrderMoney';

describe('dinheiro do pedido no admin', () => {
  it('usa a moeda do pedido em vez de "R$" fixo', () => {
    expect(fmtOrderMoney(5930, 'JPY')).toBe('¥ 5.930');
    expect(fmtOrderMoney(199, 'BRL')).toBe('R$ 199.00');
    expect(fmtOrderMoney(60, 'USD')).toBe('$ 60.00');
    expect(fmtOrderMoney(12.5, 'EUR')).toBe('€ 12.50');
    expect(fmtOrderMoney(10, undefined)).toBe('R$ 10.00');
  });

  it('lê o total em ienes do campo atual e do antigo', () => {
    expect(orderTotalYen({ totalYen: 6050 })).toBe(6050);
    expect(orderTotalYen({ grandTotalYen: 4000 })).toBe(4000);
    expect(orderTotalYen({})).toBe(0);
  });

  it('pedido em reais mostra produtos, frete, taxa PS e total em ienes', () => {
    const linhas = orderYenLines({ currency: 'BRL', totalYen: 6050, netProductsYen: 4000, shippingCostYen: 1950, psFeeYen: 100 });
    expect(linhas.map((l) => [l.label, l.value])).toEqual([
      ['Produtos', 4000], ['Frete', 1950], ['Taxa PS', 100], ['Total em ienes', 6050],
    ]);
    expect(linhas.at(-1)?.bold).toBe(true);
  });

  it('taxa PS isenta (0) some; pedido em ienes ou sem total não repete a linha', () => {
    expect(orderYenLines({ currency: 'BRL', totalYen: 5000, netProductsYen: 4000, shippingCostYen: 1000, psFeeYen: 0 }).map((l) => l.label))
      .toEqual(['Produtos', 'Frete', 'Total em ienes']);
    expect(orderYenLines({ currency: 'JPY', totalYen: 5930 })).toEqual([]);
    expect(orderYenLines({ currency: 'BRL' })).toEqual([]);
  });
});
